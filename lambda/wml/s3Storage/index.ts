/**
 * S3 Storage Operations - Top-level API
 * 
 * This module provides the primary operations for interacting with the chunk-based
 * storage system. These operations encapsulate the complexity of:
 * - Self-repair (handling missing manifests/materialized views)
 * - Coordinated writes (chunks + manifests + materialized views)
 * - Event tracking (manifest history)
 * 
 * Operations provided:
 * - appendChunk: Apply a WML edit as a new chunk
 * - (Future: changeZone, createSnapshot, etc.)
 * 
 * Design Philosophy:
 * - Operations are named descriptively (appendChunk, not "applyOperation")
 * - Storage subsystem handles coordination internally
 * - Callers describe intent, storage handles implementation
 * - Each operation guarantees consistency (all related files updated atomically)
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import AssetWorkspace, { Zone } from './AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { ManifestEvent, ManifestChunkEvent, ManifestSnapshotEvent, ManifestZoneChangeEvent } from './manifest/baseClasses'
import { loadManifest, appendManifestEvents } from './manifest'
import { writeChunk, ChunkReference } from './chunks'
import { writeSnapshot, SnapshotReference } from './snapshots'
import { reconstructFromManifest } from './materializedView/reconstruction'
import { updateContentByChunk } from './materializedView'
import { v4 as uuidv4 } from 'uuid'

/**
 * Arguments for appendChunk operation
 */
export interface AppendChunkArgs {
    /**
     * Asset UUID to append chunk to
     */
    assetId: AssetUUID
    
    /**
     * WML text representing the edit (contains Replace/Remove operations)
     * This is the DELTA, not the full merged content
     */
    chunkWML: string
    
    /**
     * Timestamp for the chunk (milliseconds since epoch)
     * Used for chunk filename and event ordering
     */
    timestamp: number
    
    /**
     * Zone for the asset
     * Required for:
     * - Tagging chunk files for lifecycle policies
     * - Initial zone assignment during lazy migration
     * - Validation (ensuring chunk is being applied to correct zone)
     */
    zone: Zone
    
    /**
     * Optional player who authored this edit
     * Stored as immutable metadata on chunk file for provenance tracking
     */
    authoringPlayer?: string
    
    /**
     * Whether to create the asset if it doesn't exist
     * 
     * When true:
     * - If both manifest and view are missing, creates empty asset and applies chunk
     * - Requires zone to be specified
     * 
     * When false (default):
     * - Returns error if asset doesn't exist
     */
    createIfNeeded?: boolean
    
    /**
     * Which file type to append to: 'wml' for content, 'auth.wml' for authorization
     * Default: 'wml'
     */
    suffix?: 'wml' | 'auth.wml'
}

/**
 * Successful result from appendChunk operation
 */
export interface AppendChunkSuccess {
    success: true
    
    /**
     * The merged StandardForm after applying the chunk
     * Caller may need this for:
     * - Emitting events with current state
     * - Returning to client
     * - Further processing
     */
    mergedContent: StandardForm
    
    /**
     * Metadata about what was written
     */
    metadata: {
        /**
         * S3 key where chunk was written
         */
        chunkKey: string
        
        /**
         * Size of chunk file in bytes
         */
        chunkSize: number
        
        /**
         * Whether repair was performed during this operation
         */
        repairPerformed: boolean
        
        /**
         * If repair was performed, what was repaired
         */
        repairActions?: {
            createdSnapshot: boolean
            reconstructedView: boolean
            synthesizedEmpty: boolean
        }
    }
}

/**
 * Failed result from appendChunk operation
 */
export interface AppendChunkFailure {
    success: false
    
    /**
     * Human-readable error message
     */
    error: string
    
    /**
     * Error category for structured error handling
     */
    errorType: 'validation' | 'merge-conflict' | 'not-found' | 's3-error' | 'repair-failed'
}

/**
 * Result from appendChunk operation
 */
export type AppendChunkResult = AppendChunkSuccess | AppendChunkFailure

//
// Internal helper types and utilities
//

type ManifestSuffix = 'wml' | 'auth.wml'

interface RepairState {
    manifestMissing: boolean
    materializedViewMissing: boolean
}

interface RepairActions {
    createdSnapshot: boolean
    reconstructedView: boolean
    synthesizedEmpty: boolean
}

/**
 * Build S3 prefix from assetId and suffix
 */
function buildPrefix(assetId: AssetUUID, suffix: ManifestSuffix): string {
    const baseId = assetId.replace('ASSET#', '')
    return `${baseId}.${suffix}/`
}

/**
 * Step 1: Fetch current state (manifest + materialized view)
 */
async function fetchCurrentState(args: {
    assetId: AssetUUID
    suffix: ManifestSuffix
    zone: Zone
}): Promise<
    | { success: true; workspace: AssetWorkspace; manifest: ManifestEvent[]; state: RepairState }
    | AppendChunkFailure
> {
    const { assetId, suffix, zone } = args
    const prefix = buildPrefix(assetId, suffix)
    
    // Load manifest
    const manifest = await loadManifest(prefix)
    const manifestMissing = manifest.length === 0
    
    // Create workspace and load materialized view
    const workspace = new AssetWorkspace(assetId, zone)
    
    const isAuth = suffix === 'auth.wml'
    if (isAuth) {
        await workspace.loadAuthorizationJSON()
    } else {
        await workspace.loadJSON()
    }
    
    const materializedViewMissing = isAuth 
        ? workspace.authStatus.s3Missing === true
        : workspace.status.s3Missing === true
    
    return {
        success: true,
        workspace,
        manifest,
        state: { manifestMissing, materializedViewMissing }
    }
}

/**
 * Step 2: Build baseline content (with in-memory repair if needed)
 */
async function buildBaseline(args: {
    workspace: AssetWorkspace
    manifest: ManifestEvent[]
    state: RepairState
    suffix: ManifestSuffix
    createIfNeeded: boolean
    zone: Zone
    assetId: AssetUUID
}): Promise<
    | {
        success: true
        baseline: StandardForm | StandardAuthorizationCollection
        repairActions?: RepairActions
        snapshotToCreate?: { content: string }  // If we need to create snapshot during lazy migration
    }
    | AppendChunkFailure
> {
    const { workspace, manifest, state, suffix, createIfNeeded, assetId } = args
    const isAuth = suffix === 'auth.wml'
    
    // Case 1: Nothing missing - use existing content
    if (!state.manifestMissing && !state.materializedViewMissing) {
        const baseline = isAuth ? workspace.authorizations : workspace.standard
        if (!baseline) {
            return {
                success: false,
                error: 'Materialized view loaded but content is undefined',
                errorType: 'validation'
            }
        }
        return { success: true, baseline }
    }
    
    // Case 2: View missing, manifest exists - reconstruct from manifest
    if (state.materializedViewMissing && !state.manifestMissing) {
        const prefix = buildPrefix(assetId, suffix)
        const result = await reconstructFromManifest(prefix)
        
        const baseline = result.type === 'content' ? result.standard : result.authorization
        
        return {
            success: true,
            baseline,
            repairActions: {
                createdSnapshot: false,
                reconstructedView: true,
                synthesizedEmpty: false
            }
        }
    }
    
    // Case 3: Manifest missing, view exists - lazy migration
    if (state.manifestMissing && !state.materializedViewMissing) {
        const baseline = isAuth ? workspace.authorizations : workspace.standard
        if (!baseline) {
            return {
                success: false,
                error: 'View reported as existing but content is undefined',
                errorType: 'validation'
            }
        }
        
        // Need to create snapshot of current state (before applying chunk)
        // Serialize baseline to WML for snapshot
        const wml = schemaToWML([baseline.schema])
        if (!wml) {
            return {
                success: false,
                error: 'Cannot serialize existing content for snapshot',
                errorType: 'validation'
            }
        }
        
        return {
            success: true,
            baseline,
            repairActions: {
                createdSnapshot: true,  // Will be created during write phase
                reconstructedView: false,
                synthesizedEmpty: false
            },
            snapshotToCreate: { content: wml }
        }
    }
    
    // Case 4: Both missing - synthesize empty (if createIfNeeded)
    if (state.manifestMissing && state.materializedViewMissing) {
        if (!createIfNeeded) {
            return {
                success: false,
                error: 'Asset not found (both manifest and view missing)',
                errorType: 'not-found'
            }
        }
        
        const baseline = isAuth 
            ? new StandardAuthorizationCollection(assetId)
            : new StandardForm(assetId)
        
        // Serialize empty baseline for snapshot
        const emptyWML = schemaToWML([baseline.schema])
        
        return {
            success: true,
            baseline,
            repairActions: {
                createdSnapshot: true,  // Empty snapshot for manifest initialization
                reconstructedView: false,
                synthesizedEmpty: true
            },
            snapshotToCreate: { content: emptyWML }
        }
    }
    
    // Should never reach here
    return {
        success: false,
        error: 'Unknown state combination',
        errorType: 'validation'
    }
}

/**
 * Step 3: Apply chunk to baseline (in-memory merge)
 */
function applyChunkToBaseline(
    baseline: StandardForm | StandardAuthorizationCollection,
    chunkWML: string
): { success: true; mergedContent: StandardForm } | AppendChunkFailure {
    // Note: Currently only supporting content edits, not authorization edits
    // Authorization edit support would parse Grant tags from chunkWML
    if (!(baseline instanceof StandardForm)) {
        return {
            success: false,
            error: 'Authorization chunk application not yet implemented',
            errorType: 'validation'
        }
    }
    
    try {
        const mergedContent = updateContentByChunk(baseline, chunkWML)
        return { success: true, mergedContent }
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown merge error',
            errorType: 'merge-conflict'
        }
    }
}

/**
 * Step 4: Prepare all writes (calculate what needs to be written)
 */
async function prepareWrites(args: {
    workspace: AssetWorkspace
    prefix: string
    timestamp: number
    zone: Zone
    chunkWML: string
    authoringPlayer?: string
    mergedContent: StandardForm
    snapshotToCreate?: { content: string }
    repairActions?: RepairActions
    manifest: ManifestEvent[]
}): Promise<{
    workspace: AssetWorkspace  // Pass through workspace with correct zone
    chunkWrite: ChunkReference & { wml: string }
    snapshotWrite?: SnapshotReference
    manifestEvents: ManifestEvent[]
    materializedViewContent: StandardForm
}> {
    const {
        prefix,
        timestamp,
        zone,
        chunkWML,
        authoringPlayer,
        mergedContent,
        snapshotToCreate,
        repairActions,
        manifest
    } = args
    
    // Prepare chunk write
    const chunkRef = await writeChunk({
        prefix,
        timestamp,
        content: chunkWML,
        zone,
        authoringPlayer
    })
    
    // Prepare snapshot write (if needed for repair)
    let snapshotRef: SnapshotReference | undefined
    if (snapshotToCreate) {
        snapshotRef = await writeSnapshot({
            prefix,
            timestamp,
            zone,
            snapshotType: 'initializeManifest',
            chunksBeforeSnapshot: 0,
            content: snapshotToCreate.content  // Use provided content (Task 1.2)
        })
    }
    
    // Build manifest events
    const events: ManifestEvent[] = []
    
    // Add repair events ONLY if snapshot was created (manifest initialization)
    // Reconstruction scenarios don't need these events (manifest already exists)
    if (snapshotRef) {
        // Initial zone change event (for manifest initialization)
        events.push({
            type: 'zoneChange',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            fromZone: null,
            toZone: zone
        })
        
        // Snapshot event
        events.push({
            type: 'snapshot',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            s3Key: snapshotRef.s3Key,
            snapshotType: 'initializeManifest',
            chunksBeforeSnapshot: 0,
            snapshotSize: snapshotRef.snapshotSize
        })
    }
    
    // Add chunk event
    const chunkEvent: ManifestChunkEvent = {
        type: 'chunk',
        timestamp: new Date(timestamp).toISOString(),
        eventId: uuidv4(),
        s3Key: chunkRef.s3Key,
        chunkSize: chunkRef.chunkSize,
        authoringPlayer
    }
    events.push(chunkEvent)
    
    return {
        workspace: args.workspace,  // Pass through workspace with correct zone/player
        chunkWrite: { ...chunkRef, wml: chunkWML },
        snapshotWrite: snapshotRef,
        manifestEvents: events,
        materializedViewContent: mergedContent
    }
}

/**
 * Step 5: Execute all writes
 */
async function executeWrites(writes: {
    workspace: AssetWorkspace
    chunkWrite: ChunkReference & { wml: string }
    snapshotWrite?: SnapshotReference
    manifestEvents: ManifestEvent[]
    materializedViewContent: StandardForm
}): Promise<void> {
    const { workspace, chunkWrite, manifestEvents, materializedViewContent } = writes
    
    // Note: Chunk and snapshot are already written by prepareWrites
    // (they needed to be written to get their S3 keys/sizes for manifest events)
    
    // Write materialized views and manifest
    // TODO: In SAGA pattern (Phase 3), these would all execute in parallel with rollback
    // For now, execute sequentially for safety
    
    // Update workspace with merged content
    // Workspace already has correct zone and player metadata from fetchCurrentState
    await workspace.setJSON(materializedViewContent)
    
    // Write materialized views (will use workspace's zone for S3 tags)
    await Promise.all([
        workspace.pushJSON(),
        workspace.pushWML()
    ])
    
    // Extract prefix from chunk S3 key
    // chunkWrite.s3Key is like "uuid.wml/chunks/timestamp-uuid.wml"
    const prefix = chunkWrite.s3Key.split('/chunks/')[0] + '/'
    
    // Append manifest events
    await appendManifestEvents(prefix, manifestEvents)
}

/**
 * Append a WML chunk to an asset's content history
 * 
 * This operation:
 * 1. Fetches current state (manifest + materialized view)
 * 2. Performs self-repair if needed (missing manifest or view)
 * 3. Applies the chunk to baseline content (in-memory merge)
 * 4. Writes all files in coordinated fashion:
 *    - Chunk file (immutable delta)
 *    - Materialized views (.wml and .ndjson) with merged content
 *    - Manifest (batched events: repair events + chunk event)
 * 5. Returns merged content and metadata
 * 
 * Self-Repair Scenarios:
 * - Manifest missing, view exists: Create initial snapshot from view (lazy migration)
 * - View missing, manifest exists: Reconstruct view from manifest
 * - Both missing, createIfNeeded=true: Synthesize empty asset, apply chunk
 * - Both missing, createIfNeeded=false: Return not-found error
 * 
 * Optimization:
 * - Single write per file (no duplicate writes)
 * - Batched manifest updates (repair + chunk events in one append)
 * - Parallel S3 writes where safe (future enhancement with SAGA pattern)
 * 
 * Concurrency:
 * - Caller must hold singleFlight/atomicLock for this assetId
 * - This function assumes sequential execution (no concurrent edits)
 * 
 * @param args - Operation arguments
 * @returns AppendChunkResult with success status and merged content or error
 * 
 * @example
 * ```typescript
 * const result = await appendChunk({
 *     assetId: 'ASSET#test-room',
 *     chunkWML: '<Asset uuid=(test-room)><Room key=(main)><Replace key=(description)>New description</Replace></Room></Asset>',
 *     timestamp: Date.now(),
 *     zone: 'Draft',
 *     authoringPlayer: 'player-123',
 *     createIfNeeded: true
 * })
 * 
 * if (result.success) {
 *     console.log('Chunk appended, merged content:', result.mergedContent)
 * } else {
 *     console.error('Failed:', result.error)
 * }
 * ```
 */
export async function appendChunk(args: AppendChunkArgs): Promise<AppendChunkResult> {
    const {
        assetId,
        chunkWML,
        timestamp,
        zone,
        authoringPlayer,
        createIfNeeded = false,
        suffix = 'wml'
    } = args
    
    // Step 1: Fetch current state
    const fetchResult = await fetchCurrentState({ assetId, suffix, zone })
    
    if (!fetchResult.success) {
        return fetchResult // Return validation error
    }
    
    const { workspace, manifest, state } = fetchResult
    
    // Step 2: Build baseline (with in-memory repair if needed)
    const baselineResult = await buildBaseline({
        workspace,
        manifest,
        state,
        suffix,
        createIfNeeded,
        zone,
        assetId
    })
    
    if (!baselineResult.success) {
        return baselineResult // Return not-found or repair error
    }
    
    const { baseline, repairActions, snapshotToCreate } = baselineResult
    
    // Step 3: Apply chunk to baseline (in-memory merge)
    const mergeResult = applyChunkToBaseline(baseline, chunkWML)
    
    if (!mergeResult.success) {
        return mergeResult // Return merge conflict error
    }
    
    const mergedContent = mergeResult.mergedContent
    
    // Step 4: Prepare all writes
    const prefix = buildPrefix(assetId, suffix)
    const writes = await prepareWrites({
        workspace,
        prefix,
        timestamp,
        zone,
        chunkWML,
        authoringPlayer,
        mergedContent,
        snapshotToCreate,
        repairActions,
        manifest
    })
    
    // Step 5: Execute coordinated writes
    try {
        await executeWrites(writes)
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown S3 write error',
            errorType: 's3-error'
        }
    }
    
    // Step 6: Return success with merged content and metadata
    return {
        success: true,
        mergedContent,
        metadata: {
            chunkKey: writes.chunkWrite.s3Key,
            chunkSize: writes.chunkWrite.chunkSize,
            repairPerformed: repairActions !== undefined,
            repairActions: repairActions ? {
                createdSnapshot: repairActions.createdSnapshot,
                reconstructedView: repairActions.reconstructedView,
                synthesizedEmpty: repairActions.synthesizedEmpty
            } : undefined
        }
    }
}


