/**
 * Move Asset functionality for WML DataSource
 * 
 * Phase 1: This module handles asset zone transitions by updating S3 object tags.
 * With flat UUID-based storage, zone transitions are simple tag updates rather than
 * file copy+delete operations.
 */

import { s3Client } from "@tonylb/mtw-asset-workspace/ts/clients"
import { MoveAssetRequest } from "../coordinationSerializer"
import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { appendManifestEventsWithLazyMigration } from "../utilities/appendManifestEventsWithLazyMigration"
import { ManifestZoneChangeEvent } from "../../s3Storage/manifest/baseClasses"
import AssetWorkspace from "../../s3Storage/AssetWorkspace"
import { v4 as uuidv4 } from 'uuid'
import { now } from "../../utilities/mockableTime"

export interface MoveAssetResponse {
    success: boolean
    message?: string
    newLocation?: string
}

/**
 * Move an asset from one zone to another
 * 
 * Phase 1: With flat UUID-based storage, this function simply updates the Zone tag
 * on S3 objects. No file copying or path changes are needed.
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
 * @param request - Zone transition request (fromZone, toZone)
 *                  Note: player/subFolder fields are deprecated and ignored
 */
export async function moveAsset(assetId: AssetUUID, request: MoveAssetRequest): Promise<MoveAssetResponse> {
    const { fromZone, toZone } = request
    
    // Phase 1: Validate that we're not trying to move TO Personal/Draft from Canon/Library
    // (would require player metadata that doesn't exist on Canon/Library assets)
    if ((toZone === 'Personal' || toZone === 'Draft') && 
        (fromZone === 'Canon' || fromZone === 'Library')) {
        return {
            success: false,
            message: `Cannot move from ${fromZone} to ${toZone}: Target zone requires player metadata that doesn't exist on source asset. Use copy operation instead.`
        }
    }
    
    try {
        const fileName = assetId.replace('ASSET#', '')
        
        // Handle Archive zone as deletion (Phase 1 defers proper archiving to Phase 2)
        if (toZone === 'Archive') {
            // TODO Phase 2: Replace deletion with Zone='Archive' tag when implementing chunk-based storage
            return {
                success: false,
                message: 'Archive functionality deferred to Phase 2'
            }
        }
        
        // Always use lazy migration helper - it handles all cases
        const timestamp = now()
        const contentPrefix = `${fileName}.wml/`
        const authPrefix = `${fileName}.auth.wml/`
        
        const zoneChangeEvent: ManifestZoneChangeEvent = {
            type: 'zoneChange',
            timestamp: new Date(timestamp).toISOString(),
            eventId: uuidv4(),
            fromZone,
            toZone
        }
        
        // Load asset content for the helper function
        const contentWorkspace = new AssetWorkspace({ zone: fromZone, fileName })
        const authWorkspace = new AssetWorkspace({ zone: fromZone, fileName, isAuth: true })
        
        await Promise.all([
            contentWorkspace.loadJSON(),
            authWorkspace.loadJSON()
        ])
        
        // Always call the helper function - it handles all cases including empty assets
        const manifestUpdates = [
            appendManifestEventsWithLazyMigration(contentPrefix, contentWorkspace, timestamp, [zoneChangeEvent]),
            appendManifestEventsWithLazyMigration(authPrefix, authWorkspace, timestamp, [zoneChangeEvent])
        ]
            
            // Update Zone tags on materialized views
            const tagUpdates = [
                s3Client.updateTags({ Key: `${fileName}.wml`, Tags: { Zone: toZone } }),
                s3Client.updateTags({ Key: `${fileName}.ndjson`, Tags: { Zone: toZone } }),
                s3Client.updateTags({ Key: `${fileName}.auth.wml`, Tags: { Zone: toZone } }),
                s3Client.updateTags({ Key: `${fileName}.auth.ndjson`, Tags: { Zone: toZone } })
            ]
            
        // Execute all updates in parallel
        await Promise.all([...manifestUpdates, ...tagUpdates])
        
        return {
            success: true,
            message: `Asset ${assetId} zone changed from ${fromZone} to ${toZone}`,
            newLocation: fileName
        }
        
    } catch (error) {
        console.error(`Error moving asset ${assetId}:`, error)
        return {
            success: false,
            message: `Failed to update zone tags: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}

// Phase 1: Helper functions for path-based moves removed
// Zone transitions are now simple tag updates on existing files
