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
import { ManifestEvent } from '../baseClasses'

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
     * Human-readable list of actions taken during repair
     * (for logging and observability)
     */
    repairActions: string[]
    
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
    prefix: string
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
 * Assess what we need to know based on the operation, and check any unknowns.
 * 
 * Returns a complete RepairState with all unknowns resolved to known values.
 * 
 * TODO: This is a stub - actual implementation will check S3 for unknown states.
 * For now, we'll treat undefined as "needs checking" and error if we encounter it.
 */
async function assessAndCheckState(
    prefix: string,
    state: RepairState,
    operation: RepairOperation
): Promise<RepairState> {
    const resolvedState: RepairState = { ...state }
    
    // TODO: Implement actual S3 checking
    // For now, error if we encounter undefined (caller should have checked)
    if (resolvedState.manifestMissing === undefined) {
        throw new Error('Manifest state unknown - caller should check before calling repair')
    }
    
    if (resolvedState.materializedViewMissing === undefined) {
        throw new Error('Materialized view state unknown - caller should check before calling repair')
    }
    
    return resolvedState
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
 * @param args - Repair arguments including prefix, state, operation, and timestamp
 * @returns RepairResult with success status, actions taken, and events to append
 */
export async function immediateSelfRepair(args: ImmediateSelfRepairArgs): Promise<RepairResult> {
    const { prefix, state, operation, timestamp } = args
    const repairActions: string[] = []
    
    // Step 1: Assess and check state (resolve unknowns)
    // NOTE: Currently we resolve ALL unknowns upfront because every decision path
    // needs to know both manifestMissing and materializedViewMissing states.
    // This is a CONTINGENT fact, not absolute. If future operations have decision
    // paths where one state is sufficient (e.g., "manifest missing → do X regardless
    // of view state"), we could optimize to lazily resolve only needed state.
    // The assessAndCheckState() function would then need operation-aware logic
    // to determine which checks are actually required.
    const resolvedState = await assessAndCheckState(prefix, state, operation)
    
    // Step 2: Early exit if nothing missing
    if (resolvedState.manifestMissing === false && resolvedState.materializedViewMissing === false) {
        return {
            success: true,
            repairActions: [],
            eventsToAppend: []
        }
    }
    
    // Step 3: Decide what to do with materialized view
    const viewAction = decideMaterializedViewAction(resolvedState, operation)
    
    if (viewAction.type === 'error') {
        return {
            success: false,
            repairActions,
            error: viewAction.message
        }
    }
    
    // Step 4: Decide snapshot action
    const snapshotAction = decideSnapshotAction(resolvedState, operation)
    
    // Step 5: Decide manifest action
    const manifestAction = decideManifestAction(resolvedState, snapshotAction)
    
    // TODO: Step 6: Execute materialized view action
    // - use-existing: nothing to do
    // - reconstruct: call reconstructFromManifest, write to S3
    // - synthesize-empty: create empty StandardForm/StandardAuthorizationCollection, write to S3
    
    // TODO: Step 7: Execute snapshot action
    // - create: write snapshot from materialized view
    // - skip: nothing to do
    
    // TODO: Step 8: Build and return manifest events
    // - initialize: create ZoneChange (fromZone: null) + optional Snapshot event
    // - append-to-existing: create operation-specific events
    
    repairActions.push(`View action: ${viewAction.type}`)
    repairActions.push(`Snapshot action: ${snapshotAction.type}`)
    repairActions.push(`Manifest action: ${manifestAction.type}`)
    
    return {
        success: false,
        repairActions,
        error: 'Execution steps not yet implemented'
    }
}

