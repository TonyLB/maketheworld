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
import { ManifestEvent } from './manifest/baseClasses'

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
    // Implementation in Task 2.2
    throw new Error('Not implemented yet - Task 2.2')
}


