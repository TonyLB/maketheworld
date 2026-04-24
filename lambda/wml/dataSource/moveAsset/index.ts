/**
 * Move Asset functionality for WML DataSource
 * 
 * This module handles asset zone transitions by delegating to the s3Storage
 * changeZone operation, which manages S3 tags, manifests, and self-repair.
 */

import { MoveAssetRequest } from '../localApiEvents'
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { changeZone } from "../../s3Storage"
import { now } from "../../utilities/mockableTime"

export interface MoveAssetResponse {
    success: boolean
    message?: string
    newLocation?: string
}

/**
 * Move an asset from one zone to another
 * 
 * Business logic responsibilities:
 * - Validate zone transition rules (player metadata requirements)
 * - Map storage result to domain response
 * - Note: Archive zone is now supported (adds ZoneChangeEvent to manifest)
 * 
 * Storage operations delegated to changeZone():
 * - S3 tag updates
 * - Manifest zone change events
 * - Self-repair if needed
 * 
 * IMPORTANT LIMITATION: This function can only move assets that already have appropriate
 * S3 metadata for the target zone. Since Player metadata is immutable (set at object creation):
 * - ✅ Personal/Draft → Library/Canon: Allowed (publishing workflow)
 * - ❌ Library/Canon → Personal/Draft: NOT ALLOWED (would require player metadata)
 * 
 * To "move" a Canon/Library asset to Personal, use a copy operation instead, which
 * creates a new object with player metadata.
 * 
 * @param assetId - The asset UUID (does not change during move)
 * @param request - Zone transition request (fromZone, toZone, optional player)
 *                  `player` is forwarded to storage when present (needed for Personal/Draft source zones).
 *                  `subFolder` is legacy and ignored here.
 */
export async function moveAsset(assetId: AssetUUID, request: MoveAssetRequest): Promise<MoveAssetResponse> {
    const { fromZone, toZone, player } = request
    
    // Validate that we're not trying to move TO Personal/Draft from Canon/Library
    // (would require player metadata that doesn't exist on Canon/Library assets)
    if ((toZone === 'Personal' || toZone === 'Draft') && 
        (fromZone === 'Canon' || fromZone === 'Library')) {
        return {
            success: false,
            message: `Cannot move from ${fromZone} to ${toZone}: Target zone requires player metadata that doesn't exist on source asset. Use copy operation instead.`
        }
    }
    
    // Delegate to storage system
    const result = await changeZone({
        assetId,
        fromZone,
        toZone,
        timestamp: now(),
        player,
    })
    
    // Map storage result to domain response
    if (result.success) {
        const fileName = assetId.replace('ASSET#', '')
        return {
            success: true,
            message: `Asset ${assetId} zone changed from ${fromZone} to ${toZone}`,
            newLocation: fileName
        }
    } else {
        console.log(`Move failed: ${result.error}`)
        return {
            success: false,
            message: result.error
        }
    }
}

// Phase 1: Helper functions for path-based moves removed
// Zone transitions are now simple tag updates on existing files
