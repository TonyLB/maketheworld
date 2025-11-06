/**
 * Purge Asset functionality for WML DataSource
 * 
 * This module handles permanent asset deletion by delegating to the s3Storage
 * purgeAsset operation, which manages deletion of all associated files.
 */

import { AssetUUID } from "@tonylb/mtw-base/ts/schema"
import { purgeAsset as s3PurgeAsset } from "../../s3Storage"

export interface PurgeAssetRequest {
    /**
     * Expected zone for validation
     * Only Draft and Archive zones can be purged
     */
    expectedZone: 'Draft' | 'Archive'
    
    /**
     * Whether to require the asset to exist
     * Default: true (fails if asset doesn't exist)
     * Set to false for idempotent deletion
     */
    requireExists?: boolean
}

export interface PurgeAssetResponse {
    success: boolean
    message?: string
    objectsDeleted?: number
}

/**
 * Permanently delete an asset and all its associated files
 * 
 * Business logic responsibilities:
 * - Validate zone restrictions (only Draft/Archive allowed)
 * - Map storage result to domain response
 * 
 * Storage operations delegated to purgeAsset():
 * - Zone validation and safety checks
 * - Deletion of all S3 objects (materialized views, manifests, chunks, snapshots)
 * 
 * IMPORTANT:
 * - This operation is PERMANENT and IRREVERSIBLE
 * - Only Draft and Archive zones can be purged
 * - Canon, Library, and Personal assets must be moved to Archive first
 * - No recovery mechanism exists after deletion
 * 
 * @param assetId - The asset UUID to delete
 * @param request - Purge configuration (expectedZone, requireExists)
 */
export async function purgeAsset(assetId: AssetUUID, request: PurgeAssetRequest): Promise<PurgeAssetResponse> {
    const { expectedZone, requireExists = true } = request
    
    // Delegate to storage system
    const result = await s3PurgeAsset({
        assetId,
        expectedZone,
        requireExists
    })
    
    // Map storage result to domain response
    if (result.success) {
        return {
            success: true,
            message: `Asset ${assetId} permanently deleted from ${result.metadata.zone} zone`,
            objectsDeleted: result.metadata.objectsDeleted
        }
    } else {
        console.log(`Purge failed: ${result.error}`)
        return {
            success: false,
            message: result.error
        }
    }
}

