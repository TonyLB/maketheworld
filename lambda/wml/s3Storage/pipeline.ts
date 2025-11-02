/**
 * Storage Operation Pipeline
 * 
 * Generic orchestration framework for storage operations using the linear flow pattern.
 * 
 * This module provides:
 * - Shared fetch-and-decide logic (what repair is needed?)
 * - Generic pipeline for executing operation-specific strategies
 * - Separation of decisions (pure logic) from execution (I/O)
 * 
 * Pattern:
 * 1. Fetch current state (manifest + view)
 * 2. Assess what's missing
 * 3. Decide repair strategy (reconstruct/synthesize/use-existing)
 * 4. Pass decision + baseline to operation-specific execution strategy
 * 5. Strategy can optimize based on repair decision
 * 
 * See: AGENT.selfRepair.md for design rationale and repair scenarios
 */

import { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import AssetWorkspace, { Zone } from './AssetWorkspace'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { ManifestEvent } from './manifest/baseClasses'
import { loadManifest } from './manifest'
import { reconstructFromManifest } from './materializedView/reconstruction'
import { buildPrefix, ManifestSuffix } from './tools'

/**
 * Assessment of which S3 files are present vs. missing
 */
export interface RepairState {
    manifestMissing: boolean
    materializedViewMissing: boolean
}

/**
 * Actions that were taken during repair
 */
export interface RepairActions {
    createdSnapshot: boolean
    reconstructedView: boolean
    synthesizedEmpty: boolean
}

/**
 * Decision about what repair is needed and how to do it
 * 
 * This is the "decision" that gets passed to execution strategies,
 * allowing them to optimize based on whether repair happened.
 */
export interface RepairDecision {
    /**
     * What repair actions are needed (undefined if no repair)
     */
    repairActions?: RepairActions
    
    /**
     * If we need to create a snapshot, this contains the content
     * (used during lazy migration or empty synthesis)
     */
    snapshotToCreate?: {
        content: string
    }
}

/**
 * Result of fetch-and-decide phase
 */
export interface FetchAndDecideResult {
    /**
     * Baseline content (loaded, reconstructed, or synthesized)
     */
    baseline: StandardForm | StandardAuthorizationCollection
    
    /**
     * Decision about what repair is needed
     */
    repairDecision: RepairDecision
    
    /**
     * AssetWorkspace instance (can be reused by execution strategy)
     */
    workspace: AssetWorkspace
    
    /**
     * Current manifest events
     */
    manifest: ManifestEvent[]
}

/**
 * Generic operation failure
 */
export interface OperationFailure {
    success: false
    error: string
    errorType: 'validation' | 'not-found' | 's3-error' | 'repair-failed'
}

/**
 * Fetch current state and decide what repair is needed
 * 
 * This is the "fetch and decide" phase of the linear flow pattern.
 * It assesses state, determines repair needs, and prepares baseline content
 * (with in-memory repair if needed), but does NOT write anything.
 * 
 * The repair decision is returned as a value that execution strategies
 * can use to optimize their behavior.
 * 
 * @param args - Fetch arguments
 * @returns FetchAndDecideResult with baseline and repair decision, or OperationFailure
 */
export async function fetchAndDecideRepair(args: {
    assetId: AssetUUID
    suffix: ManifestSuffix
    zone: Zone
    createIfNeeded: boolean
    player?: string
}): Promise<FetchAndDecideResult | OperationFailure> {
    const { assetId, suffix, zone, createIfNeeded, player } = args
    const prefix = buildPrefix(assetId, suffix)
    
    // Step 1: Load manifest
    const manifest = await loadManifest(prefix)
    const manifestMissing = manifest.length === 0
    
    // Step 2: Create workspace and load materialized view
    const workspace = new AssetWorkspace(assetId, zone, player)
    const isAuth = suffix === 'auth.wml'
    
    if (isAuth) {
        await workspace.loadAuthorizationJSON()
    } else {
        await workspace.loadJSON()
    }
    
    const materializedViewMissing = isAuth 
        ? workspace.authStatus.s3Missing === true
        : workspace.status.s3Missing === true
    
    const state: RepairState = { manifestMissing, materializedViewMissing }
    
    // Step 3: Build baseline with repair decision (all in-memory)
    const baselineResult = await decideAndBuildBaseline({
        workspace,
        manifest,
        state,
        suffix,
        createIfNeeded,
        zone,
        assetId
    })
    
    if (!baselineResult.success) {
        return baselineResult
    }
    
    return {
        baseline: baselineResult.baseline,
        repairDecision: {
            repairActions: baselineResult.repairActions,
            snapshotToCreate: baselineResult.snapshotToCreate
        },
        workspace,
        manifest
    }
}

/**
 * Decide repair strategy and build baseline (in-memory)
 * 
 * This encapsulates the decision logic about what repair is needed
 * and builds the baseline content without writing to S3.
 */
async function decideAndBuildBaseline(args: {
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
        snapshotToCreate?: { content: string }
    }
    | OperationFailure
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
        
        // Need to create snapshot of current state (before applying operation)
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
                createdSnapshot: true,  // Will be created during execution
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
 * Execution strategy function type
 * 
 * Strategies receive:
 * - baseline: The content to operate on (loaded/reconstructed/synthesized)
 * - repairDecision: What repair was needed (can optimize based on this)
 * - fetchResult: Full context (workspace, manifest, etc.)
 * - args: Operation-specific arguments
 * 
 * Strategies return operation-specific results.
 */
export type ExecutionStrategy<TArgs, TResult> = (
    baseline: StandardForm | StandardAuthorizationCollection,
    repairDecision: RepairDecision,
    fetchResult: FetchAndDecideResult,
    args: TArgs
) => Promise<TResult>

/**
 * Generic storage operation pipeline
 * 
 * This orchestrates the linear flow:
 * 1. Fetch current state and decide repair (shared logic)
 * 2. Execute operation-specific strategy with repair decision
 * 
 * The strategy function can optimize based on the repair decision:
 * - If no repair (repairDecision.repairActions undefined): Can use fast paths
 * - If repair needed: May need to write content anyway
 * 
 * This pattern enables both:
 * - Code reuse (shared fetch-and-decide logic)
 * - Operation-specific optimizations (strategies can branch on repair decision)
 * 
 * @param fetchArgs - Arguments for fetch-and-decide phase
 * @param operationArgs - Operation-specific arguments
 * @param strategy - Execution strategy for this operation
 * @returns Result from strategy execution
 */
export async function applyStorageOperation<TArgs, TResult>(
    fetchArgs: {
        assetId: AssetUUID
        suffix: ManifestSuffix
        zone: Zone
        createIfNeeded: boolean
        player?: string
    },
    operationArgs: TArgs,
    strategy: ExecutionStrategy<TArgs, TResult>
): Promise<TResult | OperationFailure> {
    // Phase 1: Fetch and decide (shared logic)
    const fetchResult = await fetchAndDecideRepair(fetchArgs)
    
    if ('errorType' in fetchResult) {
        // Fetch failed - return error
        return fetchResult
    }
    
    // Phase 2: Execute operation-specific strategy
    try {
        return await strategy(
            fetchResult.baseline,
            fetchResult.repairDecision,
            fetchResult,
            operationArgs
        )
    } catch (err) {
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown error during execution',
            errorType: 's3-error'
        }
    }
}

