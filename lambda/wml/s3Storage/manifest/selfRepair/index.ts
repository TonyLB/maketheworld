/**
 * Self-Repair Infrastructure
 * 
 * Centralized logic for handling missing manifest and materialized view files.
 * Provides on-the-spot repair strategies for write operations that encounter
 * incomplete S3 state.
 * 
 * See: s3Storage/manifest/AGENT.selfRepair.md for design rationale
 */

import { Zone } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ManifestEvent } from '../baseClasses'
import { loadManifest } from '../operations'
import AssetWorkspace from '../../AssetWorkspace'
import { reconstructFromManifest } from '../reconstruction'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { writeSnapshot, SnapshotReference } from '../snapshots'
import { v4 as uuidv4 } from 'uuid'

/**
 * Manifest suffix for content vs authorization files
 * Matches the file types used by AssetWorkspace.s3KeyFor()
 */
export type ManifestSuffix = 'wml' | 'auth.wml'

/**
 * Assessment of which S3 files are present vs. missing
 * 
 * Each field can be:
 * - true: Known to be missing (file does not exist)
 * - false: Known to exist (file is present)
 * - undefined: Unknown (not yet checked)
 */
export interface RepairState {
    manifestMissing?: boolean
    materializedViewMissing?: boolean
}

/**
 * Metadata about the operation being performed when repair is needed.
 * Different operations have different capabilities for what they can repair.
 */
export type RepairOperation = 
    | { 
        type: 'applyEdit'
        data: { 
            editWML: string  // WML text with Replace/Remove operations
            zone: Zone
            createIfNeeded: boolean
        }
    }
    | { 
        type: 'moveZone'
        data: { 
            fromZone: Zone
            toZone: Zone
        }
    }
    | { 
        type: 'writeSnapshot'
        data: { 
            zone: Zone
            timestamp: number
        }
    }

/**
 * Result of a repair operation
 */
export interface RepairResult {
    /**
     * Whether repair succeeded
     */
    success: boolean
    
    /**
     * Manifest events that should be appended by the caller
     * (repair creates these but doesn't append them - caller holds atomicLock)
     */
    eventsToAppend?: ManifestEvent[]
    
    /**
     * Error message if repair failed
     */
    error?: string
}

/**
 * Type guards for RepairOperation union
 */
export const isApplyEditOperation = (op: RepairOperation): op is Extract<RepairOperation, { type: 'applyEdit' }> => {
    return op.type === 'applyEdit'
}

export const isMoveZoneOperation = (op: RepairOperation): op is Extract<RepairOperation, { type: 'moveZone' }> => {
    return op.type === 'moveZone'
}

export const isWriteSnapshotOperation = (op: RepairOperation): op is Extract<RepairOperation, { type: 'writeSnapshot' }> => {
    return op.type === 'writeSnapshot'
}

/**
 * Arguments for immediateSelfRepair function
 */
export interface ImmediateSelfRepairArgs {
    assetId: AssetUUID
    suffix: ManifestSuffix
    state: RepairState
    operation: RepairOperation
    timestamp: number
}

/**
 * Decision about what to do with materialized view
 */
type MaterializedViewAction = 
    | { type: 'use-existing' }
    | { type: 'reconstruct' }  // From manifest
    | { type: 'synthesize-empty' }
    | { type: 'error', message: string }

/**
 * Decision about what to do with snapshot
 */
type SnapshotAction = 
    | { type: 'create', source: 'materialized-view' }
    | { type: 'skip' }

/**
 * Decision about what to do with manifest
 */
type ManifestAction = 
    | { type: 'initialize', includeSnapshot: boolean }
    | { type: 'append-to-existing' }

/**
 * Step 1: Decide what to do with materialized view
 * 
 * Note: This assumes state has been fully assessed (no undefined values).
 * Call assessAndCheckState() first to resolve unknowns.
 */
function decideMaterializedViewAction(
    state: RepairState,
    operation: RepairOperation
): MaterializedViewAction {
    if (state.materializedViewMissing === false) {
        return { type: 'use-existing' }
    }
    
    if (state.manifestMissing === false) {
        // View missing but manifest exists → reconstruct
        return { type: 'reconstruct' }
    }
    
    // Both missing → check if operation supports synthesis
    if (isApplyEditOperation(operation) && operation.data.createIfNeeded) {
        return { type: 'synthesize-empty' }
    }
    
    if (isMoveZoneOperation(operation)) {
        return { type: 'synthesize-empty' }
    }
    
    if (isWriteSnapshotOperation(operation)) {
        return { type: 'error', message: 'Cannot snapshot empty content (both manifest and view missing)' }
    }
    
    if (isApplyEditOperation(operation) && !operation.data.createIfNeeded) {
        return { type: 'error', message: 'Cannot edit non-existent asset (createIfNeeded not set)' }
    }
    
    return { type: 'error', message: 'Unknown operation type' }
}

/**
 * Step 2: Decide whether we need to create a snapshot
 */
function decideSnapshotAction(
    state: RepairState,
    operation: RepairOperation
): SnapshotAction {
    // Lazy migration: need snapshot to initialize manifest
    if (state.manifestMissing) {
        return { type: 'create', source: 'materialized-view' }
    }
    
    // Manual snapshot request
    if (isWriteSnapshotOperation(operation)) {
        return { type: 'create', source: 'materialized-view' }
    }
    
    // Otherwise, no snapshot needed
    return { type: 'skip' }
}

/**
 * Step 3: Decide what to do with manifest
 */
function decideManifestAction(
    state: RepairState,
    snapshotAction: SnapshotAction
): ManifestAction {
    if (state.manifestMissing) {
        // Initialize manifest (with or without snapshot event)
        return { 
            type: 'initialize', 
            includeSnapshot: snapshotAction.type === 'create'
        }
    }
    
    // Manifest exists, append any new events
    return { type: 'append-to-existing' }
}

/**
 * Result of state assessment including resolved state and AssetWorkspace for reuse
 */
interface AssessmentResult {
    state: RepairState
    assetWorkspace: AssetWorkspace | null
}

/**
 * Reconstruct prefix from assetId and suffix
 * Converts suffix (e.g., 'wml' or 'auth.wml') to manifest prefix (e.g., 'uuid.wml/' or 'uuid.auth.wml/')
 */
function buildPrefix(assetId: AssetUUID, suffix: ManifestSuffix): string {
    const baseId = assetId.replace('ASSET#', '')
    return `${baseId}.${suffix}/`
}

/**
 * Extract zone from operation (all operations provide zone information)
 * 
 * For moveZone operations during lazy migration (manifest initialization):
 * - Returns fromZone because the initial snapshot represents the asset's origin state
 * - The manifest will then track the zone change as a subsequent event
 */
function extractZoneFromOperation(operation: RepairOperation): Zone {
    if (isApplyEditOperation(operation)) {
        return operation.data.zone
    }
    if (isMoveZoneOperation(operation)) {
        // Use source zone (fromZone) for initial snapshot during lazy migration
        return operation.data.fromZone
    }
    if (isWriteSnapshotOperation(operation)) {
        return operation.data.zone
    }
    throw new Error('Unknown operation type - cannot extract zone')
}

/**
 * Assess what we need to know based on the operation, and check any unknowns.
 * 
 * Returns a complete RepairState with all unknowns resolved to known values,
 * plus an AssetWorkspace instance that can be reused in execution steps.
 */
async function assessAndCheckState(
    assetId: AssetUUID,
    suffix: ManifestSuffix,
    state: RepairState,
    operation: RepairOperation
): Promise<AssessmentResult> {
    const resolvedState: RepairState = { ...state }
    const prefix = buildPrefix(assetId, suffix)
    
    // Check manifest existence if unknown
    if (resolvedState.manifestMissing === undefined) {
        const manifest = await loadManifest(prefix)
        resolvedState.manifestMissing = manifest.length === 0
    }
    
    // Check materialized view existence if unknown
    // Create AssetWorkspace to check and potentially use later
    const zone = extractZoneFromOperation(operation)
    const assetWorkspace = new AssetWorkspace(assetId, zone)
    
    if (resolvedState.materializedViewMissing === undefined) {
        // Load to check if materialized view exists in S3
        if (suffix === 'wml') {
            await assetWorkspace.loadJSON()
            resolvedState.materializedViewMissing = assetWorkspace.status.s3Missing === true
        } else {
            await assetWorkspace.loadAuthorizationJSON()
            resolvedState.materializedViewMissing = assetWorkspace.authStatus.s3Missing === true
        }
    }
    
    return { state: resolvedState, assetWorkspace }
}

/**
 * Execute the materialized view action (reconstruct, synthesize empty, or use existing)
 */
async function executeMaterializedViewAction(args: {
    assetId: AssetUUID
    suffix: ManifestSuffix
    viewAction: MaterializedViewAction
    assetWorkspace: AssetWorkspace | null
}): Promise<void> {
    const { assetId, suffix, viewAction, assetWorkspace } = args
    
    if (viewAction.type === 'use-existing') {
        // Nothing to do - AssetWorkspace already has the content loaded
        return
    }
    
    const prefix = buildPrefix(assetId, suffix)
    const isAuth = suffix === 'auth.wml'
    
    if (viewAction.type === 'reconstruct') {
        const result = await reconstructFromManifest(prefix)
        
        // Ensure we have an AssetWorkspace to write with
        if (!assetWorkspace) {
            throw new Error('AssetWorkspace should exist for reconstruction')
        }
        
        // Load the reconstructed content into AssetWorkspace
        if (result.type === 'content') {
            await assetWorkspace.setJSON(result.standard)
        } else {
            // TODO: Add setAuthorizationJSON() method to AssetWorkspace for consistency
            // For now, set directly (same as setAuthorizationWML does)
            assetWorkspace.authorizations = result.authorization
        }
        
        // Write to S3
        if (isAuth) {
            await Promise.all([
                assetWorkspace.pushAuthorizationJSON(),
                assetWorkspace.pushAuthorizationWML()
            ])
        } else {
            await Promise.all([
                assetWorkspace.pushJSON(),
                assetWorkspace.pushWML()
            ])
        }
        
        return
    }
    
    if (viewAction.type === 'synthesize-empty') {
        // Ensure we have an AssetWorkspace to write with
        if (!assetWorkspace) {
            throw new Error('AssetWorkspace should exist for synthesis')
        }
        
        // Create empty content and write to S3
        if (isAuth) {
            assetWorkspace.authorizations = new StandardAuthorizationCollection(assetId)
            await Promise.all([
                assetWorkspace.pushAuthorizationJSON(),
                assetWorkspace.pushAuthorizationWML()
            ])
        } else {
            const emptyStandard = new StandardForm(assetId)
            await assetWorkspace.setJSON(emptyStandard)
            await Promise.all([
                assetWorkspace.pushJSON(),
                assetWorkspace.pushWML()
            ])
        }
        
        return
    }
}

/**
 * Execute snapshot action - create snapshot or skip
 * 
 * @param args - Execution arguments
 * @returns SnapshotReference if created, null if skipped
 */
async function executeSnapshotAction(args: {
    snapshotAction: SnapshotAction
    prefix: string
    timestamp: number
    zone: Zone
    assetWorkspace: AssetWorkspace | null
}): Promise<SnapshotReference | null> {
    const { snapshotAction, prefix, timestamp, zone } = args
    
    if (snapshotAction.type === 'skip') {
        return null
    }
    
    if (snapshotAction.type === 'create') {
        const snapshotRef = await writeSnapshot({
            prefix,
            timestamp,
            zone,
            snapshotType: 'initializeManifest',  // Self-repair snapshots for lazy migration
            chunksBeforeSnapshot: 0              // For lazy migration, no chunks yet
        })
        
        return snapshotRef
    }
    
    return null
}

/**
 * Build manifest events based on manifest action
 * 
 * @param args - Event building arguments
 * @returns Array of ManifestEvents to append to manifest
 */
function buildManifestEvents(args: {
    manifestAction: ManifestAction
    zone: Zone
    timestamp: number
    snapshotRef: SnapshotReference | null
}): ManifestEvent[] {
    const { manifestAction, zone, timestamp, snapshotRef } = args
    
    if (manifestAction.type === 'append-to-existing') {
        // No repair-specific events needed when manifest exists
        return []
    }
    
    if (manifestAction.type === 'initialize') {
        const events: ManifestEvent[] = []
        const isoTimestamp = new Date(timestamp).toISOString()
        
        // Initial ZoneChange event (fromZone: null indicates zone establishment)
        events.push({
            type: 'zoneChange',
            timestamp: isoTimestamp,
            eventId: uuidv4(),
            fromZone: null,
            toZone: zone
        })
        
        // Optional: Snapshot event if snapshot was created
        if (manifestAction.includeSnapshot && snapshotRef) {
            events.push({
                type: 'snapshot',
                timestamp: isoTimestamp,
                eventId: uuidv4(),
                s3Key: snapshotRef.s3Key,
                snapshotType: 'initializeManifest',
                chunksBeforeSnapshot: 0,
                snapshotSize: snapshotRef.snapshotSize
            })
        }
        
        return events
    }
    
    return []
}

/**
 * Centralized self-repair function for handling missing manifest and materialized view files.
 * 
 * This function uses a linear flow through decision points rather than branching into
 * separate scenario handlers. This approach:
 * - Eliminates code duplication between scenarios
 * - Makes the decision tree explicit and testable
 * - Allows partial state discovery (some things known, some unknown)
 * - Combines operations where possible (e.g., snapshot + manifest init)
 * 
 * Flow:
 * 1. Assess and check state (resolve any unknowns)
 * 2. Early exit if nothing missing
 * 3. Decide materialized view action (use existing, reconstruct, synthesize empty, or error)
 * 4. Decide snapshot action (create or skip)
 * 5. Decide manifest action (initialize or append)
 * 6. Execute all actions and return events for caller to append
 * 
 * The caller is responsible for:
 * - Running within singleFlight (sequential mode) to prevent concurrent repairs
 * - Appending returned events to manifest
 * 
 * Note: Most operations should use `withS3SelfRepair()` wrapper instead of calling this directly.
 * 
 * @param args - Repair arguments including assetId, suffix, state, operation, and timestamp
 * @returns RepairResult with success status, actions taken, and events to append
 */
export async function immediateSelfRepair(args: ImmediateSelfRepairArgs): Promise<RepairResult> {
    const { assetId, suffix, state, operation, timestamp } = args
    const prefix = buildPrefix(assetId, suffix)
    
    // Step 1: Assess and check state (resolve unknowns)
    // NOTE: Currently we resolve ALL unknowns upfront because every decision path
    // needs to know both manifestMissing and materializedViewMissing states.
    // This is a CONTINGENT fact, not absolute. If future operations have decision
    // paths where one state is sufficient (e.g., "manifest missing → do X regardless
    // of view state"), we could optimize to lazily resolve only needed state.
    // The assessAndCheckState() function would then need operation-aware logic
    // to determine which checks are actually required.
    const assessment = await assessAndCheckState(assetId, suffix, state, operation)
    const resolvedState = assessment.state
    const assetWorkspace = assessment.assetWorkspace
    
    // Step 2: Early exit if nothing missing
    if (resolvedState.manifestMissing === false && resolvedState.materializedViewMissing === false) {
        return {
            success: true,
            eventsToAppend: []
        }
    }
    
    // Step 3: Decide what to do with materialized view
    const viewAction = decideMaterializedViewAction(resolvedState, operation)
    
    if (viewAction.type === 'error') {
        return {
            success: false,
            error: viewAction.message
        }
    }
    
    // Step 4: Decide snapshot action
    const snapshotAction = decideSnapshotAction(resolvedState, operation)
    
    // Step 5: Decide manifest action
    const manifestAction = decideManifestAction(resolvedState, snapshotAction)
    
    // Step 6: Execute materialized view action
    await executeMaterializedViewAction({
        assetId,
        suffix,
        viewAction,
        assetWorkspace
    })
    
    // Step 7: Execute snapshot action
    const zone = extractZoneFromOperation(operation)
    const snapshotRef = await executeSnapshotAction({
        snapshotAction,
        prefix,
        timestamp,
        zone,
        assetWorkspace
    })
    
    // Step 8: Build manifest events
    const eventsToAppend = buildManifestEvents({
        manifestAction,
        zone,
        timestamp,
        snapshotRef
    })
    
    return {
        success: true,
        eventsToAppend
    }
}

// Re-export wrapper functions for convenient import
export { withS3SelfRepair } from './wrapper'
export type { FetchFunction, ActionFunction, WithS3SelfRepairArgs } from './wrapper'

