/**
 * S3 Self-Repair Wrapper
 * 
 * Provides the `withS3SelfRepair()` higher-order function that encapsulates
 * the fetch-check-repair pattern for S3 operations.
 * 
 * This wrapper eliminates the need for operations to implement their own
 * detection and repair logic by providing a consistent integration point.
 * 
 * See: s3Storage/manifest/AGENT.selfRepair.md for design rationale
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ManifestSuffix, RepairState, RepairOperation, immediateSelfRepair } from './index'
import { appendManifestEvents } from '../operations'

/**
 * Function that attempts to load required data and assess state.
 * 
 * @returns Object containing:
 *   - data: The data needed by the action function
 *   - state: Assessment of what files are present vs missing
 */
export type FetchFunction<TData> = () => Promise<{
    data: TData
    state: RepairState
}>

/**
 * Function that executes the normal operation when data is complete.
 * 
 * @param data - The fetched data (from fetch function)
 * @returns The operation result
 */
export type ActionFunction<TData, TResult> = (data: TData) => Promise<TResult>

/**
 * Arguments for withS3SelfRepair wrapper
 */
export interface WithS3SelfRepairArgs<TData, TResult> {
    /**
     * Asset UUID to repair
     */
    assetId: AssetUUID
    
    /**
     * Which manifest suffix to repair ('wml' for content, 'auth.wml' for authorization)
     */
    suffix: ManifestSuffix
    
    /**
     * Function that loads required data and assesses state
     */
    fetch: FetchFunction<TData>
    
    /**
     * Function that executes when data is complete (no repair needed)
     */
    action: ActionFunction<TData, TResult>
    
    /**
     * Metadata describing the operation being performed
     * (used by immediateSelfRepair to determine repair path)
     */
    repairOperation: RepairOperation
    
    /**
     * Timestamp for repair events
     */
    timestamp: number
}

/**
 * Build S3 prefix from assetId and suffix
 * 
 * @param assetId - Asset UUID (e.g., 'ASSET#test')
 * @param suffix - Manifest suffix ('wml' or 'auth.wml')
 * @returns S3 prefix (e.g., 'test.wml/' or 'test.auth.wml/')
 */
function buildPrefix(assetId: AssetUUID, suffix: ManifestSuffix): string {
    const baseId = assetId.replace('ASSET#', '')
    return `${baseId}.${suffix}/`
}

/**
 * Get human-readable description of repair action
 * 
 * @param state - Repair state showing what's missing
 * @returns Description string for logging
 */
function getRepairDescription(state: RepairState): string {
    if (state.manifestMissing && state.materializedViewMissing) {
        return 'both manifest and materialized view missing'
    }
    if (state.manifestMissing) {
        return 'manifest missing'
    }
    if (state.materializedViewMissing) {
        return 'materialized view missing'
    }
    return 'no repair needed'
}

/**
 * Higher-order function that wraps S3 operations with self-repair capability.
 * 
 * This wrapper encapsulates the common pattern:
 * 1. Fetch required data and assess state
 * 2. Route between normal action or self-repair
 * 3. Handle repair if needed (create missing files, append events)
 * 4. Re-fetch and execute action with repaired state
 * 
 * Benefits:
 * - Eliminates boilerplate repair detection in each operation
 * - Provides consistent error handling and logging
 * - Centralizes repair logic for maintainability
 * - Clear separation between fetch, action, and repair concerns
 * 
 * Usage Example:
 * ```typescript
 * return await withS3SelfRepair({
 *     assetId: 'ASSET#test',
 *     suffix: 'wml',
 *     fetch: async () => {
 *         const workspace = await AssetWorkspace.fromUUID(assetId)
 *         await workspace.loadJSON()
 *         return {
 *             data: { workspace },
 *             state: {
 *                 manifestMissing: !(await manifestExists(prefix)),
 *                 materializedViewMissing: workspace.status.s3Missing
 *             }
 *         }
 *     },
 *     action: async ({ workspace }) => {
 *         // Normal operation logic
 *         return { success: true }
 *     },
 *     repairOperation: {
 *         type: 'applyEdit',
 *         data: { editWML, zone, createIfNeeded: true }
 *     },
 *     timestamp: Date.now()
 * })
 * ```
 * 
 * @param args - Wrapper arguments (assetId, suffix, fetch, action, repairOperation, timestamp)
 * @returns Result from action function
 * @throws Error if repair fails or action throws
 */
export async function withS3SelfRepair<TData, TResult>(
    args: WithS3SelfRepairArgs<TData, TResult>
): Promise<TResult> {
    const { assetId, suffix, fetch, action, repairOperation, timestamp } = args
    
    // Step 1: Execute fetch function to load data and assess state
    const { data, state } = await fetch()
    
    // Step 2: Check if repair is needed
    const needsRepair = state.manifestMissing === true || state.materializedViewMissing === true
    
    if (!needsRepair) {
        // Normal path - data is complete, execute action directly
        return await action(data)
    }
    
    // Repair path - files are missing
    console.log(`Self-repair triggered: ${getRepairDescription(state)} (${assetId}, ${suffix})`)
    
    // Step 3: Call centralized repair function
    const repairResult = await immediateSelfRepair({
        assetId,
        suffix,
        state,
        operation: repairOperation,
        timestamp
    })
    
    // Step 4: Handle repair failure
    if (!repairResult.success) {
        throw new Error(`Self-repair failed: ${repairResult.error}`)
    }
    
    // Step 5: Append repair events to manifest if any were created
    if (repairResult.eventsToAppend && repairResult.eventsToAppend.length > 0) {
        const prefix = buildPrefix(assetId, suffix)
        await appendManifestEvents(prefix, repairResult.eventsToAppend)
        console.log(`Self-repair completed: Appended ${repairResult.eventsToAppend.length} events to manifest`)
    }
    
    // Step 6: Re-fetch data with repaired state
    const { data: repairedData } = await fetch()
    
    // Step 7: Execute action with repaired data
    return await action(repairedData)
}

