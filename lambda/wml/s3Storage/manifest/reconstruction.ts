/**
 * Manifest Reconstruction
 * 
 * Rebuilds current asset state from manifest events (snapshots + chunks).
 * This is the core operation that enables chunk-based storage to work.
 * 
 * Algorithm:
 * 1. Load manifest events (chronologically ordered)
 * 2. Find latest snapshot (if any)
 * 3. Load baseline content from snapshot (or start empty)
 * 4. Apply all chunks after snapshot in chronological order
 * 5. Return final merged state
 * 
 * Design principles:
 * - Generic: Works with any prefix (content or auth)
 * - Type-aware: Returns StandardForm for content, StandardAuthorizationCollection for auth
 * - Resilient: Gracefully handles missing manifest, missing chunks, corrupt WML
 * - Efficient: Sequential loading initially (parallel optimization in Phase 3)
 */

import { s3Client } from '@tonylb/mtw-asset-workspace/ts/clients'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { StandardAuthorizationCollection } from '@tonylb/mtw-wml/ts/standardize/authorization'
import { loadManifest } from './operations'
import { isManifestSnapshotEvent, isManifestChunkEvent, ManifestEvent } from './baseClasses'
import { AssetUUID } from '@tonylb/mtw-base/ts/schema'

/**
 * Determine if prefix is for authorization content
 */
const isAuthPrefix = (prefix: string): boolean => {
    return prefix.includes('.auth.wml/')
}

/**
 * Extract asset UUID from prefix
 * 
 * Examples:
 * - "test.wml/" -> "ASSET#test"
 * - "test.auth.wml/" -> "ASSET#test"
 */
const extractAssetUUID = (prefix: string): AssetUUID => {
    // Remove trailing slash
    const withoutSlash = prefix.slice(0, -1)
    
    // Extract base name (before .wml or .auth.wml)
    const baseName = withoutSlash.replace(/\.auth\.wml$/, '').replace(/\.wml$/, '')
    
    return baseName.startsWith('ASSET#') ? baseName as AssetUUID : `ASSET#${baseName}`
}

/**
 * Reconstruction result for content prefixes
 */
export interface ContentReconstructionResult {
    type: 'content';
    standard: StandardForm;
    metadata: {
        snapshotUsed: boolean;
        chunksApplied: number;
    };
}

/**
 * Reconstruction result for auth prefixes
 */
export interface AuthReconstructionResult {
    type: 'auth';
    authorization: StandardAuthorizationCollection;
    metadata: {
        snapshotUsed: boolean;
        chunksApplied: number;
    };
}

/**
 * Union type for reconstruction results
 */
export type ReconstructionResult = ContentReconstructionResult | AuthReconstructionResult

/**
 * Reconstruct current state from manifest
 * 
 * Loads the manifest, finds the latest snapshot (if any), loads baseline content,
 * and applies all subsequent chunks in chronological order.
 * 
 * @param prefix - S3 prefix without ASSET# (e.g., "uuid.wml/" or "uuid.auth.wml/")
 * @returns Reconstruction result with type-specific content and metadata
 */
export const reconstructFromManifest = async (prefix: string): Promise<ReconstructionResult> => {
    const assetUUID = extractAssetUUID(prefix)
    const isAuth = isAuthPrefix(prefix)
    
    // Load manifest events
    const events = await loadManifest(prefix)
    
    // If no manifest exists, return empty content
    if (events.length === 0) {
        const assetKey = assetUUID.replace('ASSET#', '')
        if (isAuth) {
            return {
                type: 'auth',
                authorization: new StandardAuthorizationCollection(assetKey),
                metadata: {
                    snapshotUsed: false,
                    chunksApplied: 0
                }
            }
        } else {
            return {
                type: 'content',
                standard: new StandardForm(assetKey),
                metadata: {
                    snapshotUsed: false,
                    chunksApplied: 0
                }
            }
        }
    }
    
    // Find latest snapshot
    const snapshotEvents = events.filter(isManifestSnapshotEvent)
    const latestSnapshot = snapshotEvents.length > 0 
        ? snapshotEvents[snapshotEvents.length - 1]
        : undefined
    
    // Load baseline content
    let current: StandardForm | StandardAuthorizationCollection
    let snapshotUsed = false
    
    if (latestSnapshot) {
        // Load from snapshot
        try {
            const snapshotWML = await s3Client.get({ Key: latestSnapshot.s3Key })
            current = isAuth 
                ? new StandardAuthorizationCollection(snapshotWML)
                : new StandardForm(snapshotWML)
            snapshotUsed = true
        } catch (err: any) {
            // If snapshot is missing, fall back to empty content and log warning
            console.warn(`Snapshot ${latestSnapshot.s3Key} not found, starting from empty content:`, err)
            const assetKey = assetUUID.replace('ASSET#', '')
            current = isAuth
                ? new StandardAuthorizationCollection(assetKey)
                : new StandardForm(assetKey)
        }
    } else {
        // Start with empty content
        const assetKey = assetUUID.replace('ASSET#', '')
        current = isAuth
            ? new StandardAuthorizationCollection(assetKey)
            : new StandardForm(assetKey)
    }
    
    // Get chunks to apply (all chunks after snapshot timestamp, or all if no snapshot)
    const snapshotTimestamp = latestSnapshot?.timestamp
    const chunkEvents = events
        .filter(isManifestChunkEvent)
        .filter(event => !snapshotTimestamp || event.timestamp > snapshotTimestamp)
    
    // Kick off all S3 GET requests immediately (parallel downloads)
    // Wrap in promise that captures both success and failure
    const chunkGetPromises = chunkEvents.map(event =>
        s3Client.get({ Key: event.s3Key })
            .then(wml => ({ event, wml, success: true as const }))
            .catch(err => ({ event, wml: null, success: false as const, error: err }))
    )
    
    // Process chunks sequentially as they arrive using async reduce
    // Thread the accumulating state through the reduce for functional purity
    const { standardForm: finalStandard, chunksApplied } = await chunkGetPromises.reduce<Promise<{ standardForm: StandardForm | StandardAuthorizationCollection, chunksApplied: number }>>(
        async (previousPromise, chunkPromise) => {
            const { standardForm: accumulatedStandard, chunksApplied: count } = await previousPromise
            const result = await chunkPromise
            
            // Handle download failure
            if (!result.success) {
                console.warn(`Failed to load chunk ${result.event.s3Key}:`, result.error)
                return { standardForm: accumulatedStandard, chunksApplied: count }
            }
            
            // Try to parse and merge
            try {
                const chunkStandard = isAuth
                    ? new StandardAuthorizationCollection(result.wml!)
                    : new StandardForm(result.wml!)
                
                const mergedStandard = accumulatedStandard.merge(chunkStandard as any) as typeof accumulatedStandard
                return { standardForm: mergedStandard, chunksApplied: count + 1 }
            } catch (err: any) {
                console.warn(`Failed to apply chunk ${result.event.s3Key}:`, err)
                return { standardForm: accumulatedStandard, chunksApplied: count }
            }
        },
        Promise.resolve({ standardForm: current, chunksApplied: 0 })
    )
    
    // Return typed result
    if (isAuth) {
        return {
            type: 'auth',
            authorization: finalStandard as StandardAuthorizationCollection,
            metadata: {
                snapshotUsed,
                chunksApplied
            }
        }
    } else {
        return {
            type: 'content',
            standard: finalStandard as StandardForm,
            metadata: {
                snapshotUsed,
                chunksApplied
            }
        }
    }
}

