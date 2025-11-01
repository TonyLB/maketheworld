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
import { Zone } from './AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { ManifestEvent, ManifestChunkEvent, ManifestZoneChangeEvent } from './manifest/baseClasses'
import { appendManifestEvents } from './manifest'
import { writeChunk, ChunkReference } from './chunks'
import { writeSnapshot, SnapshotReference } from './snapshots'
import { updateContentByChunk } from './materializedView'
import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { v4 as uuidv4 } from 'uuid'
import { buildPrefix, ManifestSuffix } from './tools'
import { 
    applyStorageOperation, 
    ExecutionStrategy,
    FetchAndDecideResult,
    RepairDecision,
    RepairActions,
    OperationFailure 
} from './pipeline'

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
         * S3 key where chunk was written (undefined if chunk not written, e.g., when synthesizing empty with initial content)
         */
        chunkKey?: string
        
        /**
         * Size of chunk file in bytes (undefined if chunk not written, e.g., when synthesizing empty with initial content)
         */
        chunkSize?: number
        
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

/**
 * Arguments for changeZone operation
 */
export interface ChangeZoneArgs {
    /**
     * Asset UUID to change zone for
     */
    assetId: AssetUUID
    
    /**
     * Source zone (current zone)
     * Used for validation and initial snapshot during lazy migration
     */
    fromZone: Zone
    
    /**
     * Destination zone (new zone)
     */
    toZone: Zone
    
    /**
     * Timestamp for the zone change (milliseconds since epoch)
     * Used for event ordering and potential snapshot naming
     */
    timestamp: number
}

/**
 * Successful result from changeZone operation
 */
export interface ChangeZoneSuccess {
    success: true
    
    /**
     * Metadata about what was done
     */
    metadata: {
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
 * Failed result from changeZone operation
 */
export interface ChangeZoneFailure {
    success: false
    
    /**
     * Human-readable error message
     */
    error: string
    
    /**
     * Error category for structured error handling
     */
    errorType: 'validation' | 'not-found' | 's3-error' | 'repair-failed'
}

/**
 * Result from changeZone operation
 */
export type ChangeZoneResult = ChangeZoneSuccess | ChangeZoneFailure

//
// Internal helper types specific to index.ts operations
//

//
// Execution Strategies
//

/**
 * Execution strategy for appendChunk operation
 */
const executeAppendChunkStrategy: ExecutionStrategy<AppendChunkArgs, AppendChunkResult> = async (
    baseline,
    repairDecision,
    fetchResult,
    args
) => {
    const { chunkWML, timestamp, zone, authoringPlayer, suffix = 'wml' } = args
    const { workspace } = fetchResult
    
    // Validate: Only support content chunks currently
    if (!(baseline instanceof StandardForm)) {
        return {
            success: false,
            error: 'Authorization chunk application not yet implemented',
            errorType: 'validation'
        }
    }
    
    // Step 1: Apply chunk to baseline (in-memory merge)
    let mergedContent: StandardForm
    try {
        mergedContent = updateContentByChunk(baseline, chunkWML)
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown merge error',
            errorType: 'merge-conflict'
        }
    }
    
    // Step 2: Prepare writes
    const prefix = buildPrefix(args.assetId, suffix)
    
    // Check if we're in the optimized path: synthesizing empty + initializing with content
    const isSynthesizeEmptyInitialization = Boolean(
        repairDecision.repairActions?.synthesizedEmpty && 
        repairDecision.snapshotToCreate
    )
    
    // Write chunk file (only if NOT synthesizing empty - in that case snapshot captures initial state)
    let chunkRef: ChunkReference | undefined
    if (!isSynthesizeEmptyInitialization) {
        chunkRef = await writeChunk({
            prefix,
            timestamp,
            content: chunkWML,
            zone,
            authoringPlayer
        })
    }
    
    // Write snapshot if needed for repair
    let snapshotRef: SnapshotReference | undefined
    if (repairDecision.snapshotToCreate) {
        // Optimization: If synthesizing empty, use merged content for snapshot instead of empty baseline
        // This avoids redundant "empty snapshot + chunk" when initializing with content
        const snapshotContent = isSynthesizeEmptyInitialization
            ? schemaToWML([mergedContent.schema])!
            : repairDecision.snapshotToCreate.content
        
        snapshotRef = await writeSnapshot({
            prefix,
            timestamp,
            zone,
            snapshotType: 'initializeManifest',
            chunksBeforeSnapshot: 0,
            content: snapshotContent
        })
    }
    
    // Step 3: Build manifest events
    const events: ManifestEvent[] = []
    
    // Add repair events if snapshot was created
    if (snapshotRef) {
        events.push({
            type: 'zoneChange',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            fromZone: null,
            toZone: zone
        })
        
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
    
    // Add chunk event (only if chunk was written)
    // When synthesizing empty with content, the snapshot already captures the initial state
    if (chunkRef) {
        events.push({
            type: 'chunk',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            s3Key: chunkRef.s3Key,
            chunkSize: chunkRef.chunkSize,
            authoringPlayer
        })
    }
    
    // Step 4: Write materialized views
    await workspace.setJSON(mergedContent)
    await Promise.all([
        workspace.pushJSON(),
        workspace.pushWML()
    ])
    
    // Step 5: Append manifest events
    await appendManifestEvents(prefix, events)
    
    // Step 6: Return success
    return {
        success: true,
        mergedContent,
        metadata: {
            chunkKey: chunkRef?.s3Key,
            chunkSize: chunkRef?.chunkSize,
            repairPerformed: repairDecision.repairActions !== undefined,
            repairActions: repairDecision.repairActions ? {
                createdSnapshot: repairDecision.repairActions.createdSnapshot,
                reconstructedView: repairDecision.repairActions.reconstructedView,
                synthesizedEmpty: repairDecision.repairActions.synthesizedEmpty
            } : undefined
        }
    }
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
 * - Both missing, createIfNeeded=true: Synthesize empty asset, apply chunk (optimized: snapshot captures merged content, no chunk written)
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
    const { assetId, zone, createIfNeeded = false, suffix = 'wml' } = args
    
    // Archive zone is frozen - no new chunks allowed
    if (zone === 'Archive') {
        return {
            success: false,
            error: 'Cannot append chunks to Archive zone (frozen state)',
            errorType: 'validation'
        }
    }
    
    // Use generic pipeline with appendChunk execution strategy
    const result = await applyStorageOperation(
        {
            assetId,
            suffix,
            zone,
            createIfNeeded
        },
        args,
        executeAppendChunkStrategy
    )
    
    // Result is either AppendChunkResult or OperationFailure
    // Since OperationFailure is a subset of AppendChunkFailure, this is safe
    return result as AppendChunkResult
}

/**
 * Execution strategy for changeZone operation (single prefix)
 */
const executeChangeZoneForPrefixStrategy: ExecutionStrategy<
    { fromZone: Zone; toZone: Zone; timestamp: number; suffix: ManifestSuffix },
    { success: true; repairPerformed: boolean; repairActions?: RepairActions } | ChangeZoneFailure
> = async (baseline, repairDecision, fetchResult, args) => {
    const { fromZone, toZone, timestamp, suffix } = args
    const { workspace } = fetchResult
    const prefix = buildPrefix(fetchResult.workspace.assetId, suffix)
    const isAuth = suffix === 'auth.wml'
    
    // Step 1: Write snapshot if needed for repair
    let snapshotRef: SnapshotReference | undefined
    if (repairDecision.snapshotToCreate) {
        snapshotRef = await writeSnapshot({
            prefix,
            timestamp,
            zone: fromZone,  // Snapshot captures state before zone change
            snapshotType: 'initializeManifest',
            chunksBeforeSnapshot: 0,
            content: repairDecision.snapshotToCreate.content
        })
    }
    
    // Step 2: Build manifest events
    const events: ManifestEvent[] = []
    
    // Add repair events if snapshot was created
    if (snapshotRef) {
        events.push({
            type: 'zoneChange',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            fromZone: null,  // Initial zone establishment
            toZone: fromZone
        })
        
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
    
    // Add zone change event
    events.push({
        type: 'zoneChange',
        timestamp: new Date(timestamp).toISOString(),
        eventId: uuidv4(),
        fromZone,
        toZone
    })
    
    // Step 3: Execute writes
    // OPTIMIZATION: Branch on repair decision
    if (!repairDecision.repairActions) {
        // FAST PATH: No repair - just update S3 tags!
        // This preserves Phase 1 tag-switching speedup
        const jsonKey = isAuth ? workspace.s3KeyFor('auth.ndjson') : workspace.s3KeyFor('json')
        const wmlKey = isAuth ? workspace.s3KeyFor('auth.wml') : workspace.s3KeyFor('wml')
        
        await Promise.all([
            s3Client.updateTags({ 
                Key: jsonKey, 
                Tags: { Zone: toZone } 
            }),
            s3Client.updateTags({ 
                Key: wmlKey, 
                Tags: { Zone: toZone } 
            })
        ])
    } else {
        // REPAIR PATH: Need to write content anyway (reconstruction or synthesis)
        workspace.zone = toZone
        
        // Update workspace with baseline content
        if (isAuth && baseline instanceof StandardAuthorizationCollection) {
            workspace.authorizations = baseline
        } else if (baseline instanceof StandardForm) {
            await workspace.setJSON(baseline)
        }
        
        // Write materialized views with NEW zone tags
        if (isAuth) {
            await Promise.all([
                workspace.pushAuthorizationJSON(),
                workspace.pushAuthorizationWML()
            ])
        } else {
            await Promise.all([
                workspace.pushJSON(),
                workspace.pushWML()
            ])
        }
    }
    
    // Step 4: Append manifest events
    await appendManifestEvents(prefix, events)
    
    // Step 5: Return success
    return {
        success: true,
        repairPerformed: repairDecision.repairActions !== undefined,
        repairActions: repairDecision.repairActions
    }
}

/**
 * Helper for changeZone: apply operation to a single prefix using the pipeline
 */
async function changeZoneForPrefix(args: {
    assetId: AssetUUID
    fromZone: Zone
    toZone: Zone
    timestamp: number
    suffix: ManifestSuffix
}): Promise<{
    success: true
    repairPerformed: boolean
    repairActions?: RepairActions
} | ChangeZoneFailure> {
    // Use generic pipeline with changeZone execution strategy
    return await applyStorageOperation(
        {
            assetId: args.assetId,
            suffix: args.suffix,
            zone: args.fromZone,
            createIfNeeded: true  // Zone changes can create empty assets
        },
        args,
        executeChangeZoneForPrefixStrategy
    ) as any  // Strategy guarantees correct return type
}

/**
 * Change the zone of an asset
 * 
 * This operation:
 * 1. Fetches current state for both content and authorization files
 * 2. Performs self-repair if needed (missing manifest or views)
 * 3. Updates zone tags on all materialized view files
 * 4. Appends ZoneChangeEvent to both content and auth manifests
 * 5. Returns success with repair metadata
 * 
 * Unlike appendChunk, this operation doesn't transform content - it only
 * updates metadata. Both content and authorization files are processed
 * in parallel to ensure consistent zone information.
 * 
 * Self-Repair Scenarios:
 * - Manifest missing, view exists: Create initial snapshot from view (lazy migration)
 * - View missing, manifest exists: Reconstruct view from manifest
 * - Both missing: Synthesize empty content/auth
 * 
 * Optimization:
 * - Single write per file (no duplicate writes during repair)
 * - Batched manifest updates (repair events + zone change in one append)
 * - Parallel processing of content and auth files
 * 
 * Concurrency:
 * - Caller must hold singleFlight/atomicLock for this assetId
 * - This function assumes sequential execution (no concurrent zone changes)
 * 
 * @param args - Operation arguments
 * @returns ChangeZoneResult with success status and metadata
 * 
 * @example
 * ```typescript
 * const result = await changeZone({
 *     assetId: 'ASSET#my-room',
 *     fromZone: 'Draft',
 *     toZone: 'Library',
 *     timestamp: Date.now()
 * })
 * 
 * if (result.success) {
 *     console.log('Zone changed successfully')
 * } else {
 *     console.error('Failed:', result.error)
 * }
 * ```
 */
export async function changeZone(args: ChangeZoneArgs): Promise<ChangeZoneResult> {
    const { assetId, fromZone, toZone, timestamp } = args
    
    // Process both content and auth files in parallel
    const results = await Promise.all([
        changeZoneForPrefix({ assetId, fromZone, toZone, timestamp, suffix: 'wml' }),
        changeZoneForPrefix({ assetId, fromZone, toZone, timestamp, suffix: 'auth.wml' })
    ])
    
    // Check if either failed
    const contentResult = results[0]
    const authResult = results[1]
    
    if (!contentResult.success) {
        return contentResult
    }
    
    if (!authResult.success) {
        return authResult
    }
    
    // Both succeeded - combine repair metadata
    const repairPerformed = contentResult.repairPerformed || authResult.repairPerformed
    
    return {
        success: true,
        metadata: {
            repairPerformed,
            repairActions: repairPerformed ? {
                // Report if EITHER content or auth needed these repairs
                createdSnapshot: contentResult.repairActions?.createdSnapshot || authResult.repairActions?.createdSnapshot || false,
                reconstructedView: contentResult.repairActions?.reconstructedView || authResult.repairActions?.reconstructedView || false,
                synthesizedEmpty: contentResult.repairActions?.synthesizedEmpty || authResult.repairActions?.synthesizedEmpty || false
            } : undefined
        }
    }
}


