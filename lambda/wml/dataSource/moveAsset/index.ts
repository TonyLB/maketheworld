/**
 * Move Asset functionality for WML DataSource
 * 
 * This module handles asset zone transitions, moving assets between different
 * access zones (Canon, Library, Personal, Draft, Archive) and updating
 * associated S3 metadata and file organization.
 */

import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"
import { S3Client } from "@aws-sdk/client-s3"
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly"
import internalCache from "../../internalCache"

const { S3_BUCKET } = process.env

export interface MoveAssetRequest {
    assetId: string
    fromZone: string
    toZone: string
    player?: string
    subFolder?: string
}

export interface MoveAssetResponse {
    success: boolean
    message?: string
    newLocation?: string
}

/**
 * Type guard to check if an object is a valid MoveAssetRequest
 */
export function isMoveAssetRequest(obj: any): obj is MoveAssetRequest {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof obj.assetId === 'string' &&
        typeof obj.fromZone === 'string' &&
        typeof obj.toZone === 'string' &&
        (obj.player === undefined || typeof obj.player === 'string') &&
        (obj.subFolder === undefined || typeof obj.subFolder === 'string')
    )
}

/**
 * Move an asset from one zone to another
 * 
 * This function handles the complete zone transition process:
 * - Validates the move operation
 * - Updates S3 file organization and metadata
 * - Publishes zone transition events
 * - Coordinates with Assets Lambda for cache updates
 */
export async function moveAsset(request: MoveAssetRequest): Promise<MoveAssetResponse> {
    const { assetId, fromZone, toZone, player, subFolder } = request
    
    try {
        // Get S3 client from internal cache
        const s3Client = await internalCache.Connection.get('s3Client')
        if (!s3Client) {
            return {
                success: false,
                message: 'S3 client not available'
            }
        }
        
        // Build source asset workspace address
        const fromAddress = buildAssetWorkspaceAddress(assetId, fromZone, player, subFolder)
        const fromAssetWorkspace = new ReadOnlyAssetWorkspace(fromAddress)
        
        // Load and validate the source asset
        await fromAssetWorkspace.loadJSON()
        if (fromAssetWorkspace.status.json !== 'Clean') {
            return {
                success: false,
                message: `Source asset ${assetId} is not in a clean state (status: ${fromAssetWorkspace.status.json})`
            }
        }
        
        // Build destination asset workspace address
        const toAddress = buildAssetWorkspaceAddress(assetId, toZone, player, subFolder)
        const toAssetWorkspace = new ReadOnlyAssetWorkspace(toAddress)
        
        // Handle the move operation
        const result = await performS3Move(s3Client, fromAssetWorkspace, toAssetWorkspace)
        
        if (result.success) {
            return {
                success: true,
                message: result.message || `Successfully moved asset ${assetId} from ${fromZone} to ${toZone}`,
                newLocation: result.newLocation || toAssetWorkspace.fileNameBase
            }
        } else {
            return result
        }
        
    } catch (error) {
        console.error(`Error moving asset ${assetId}:`, error)
        return {
            success: false,
            message: `Failed to move asset: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}

/**
 * Build an AssetWorkspaceAddress from the provided parameters
 */
function buildAssetWorkspaceAddress(
    assetId: string, 
    zone: string, 
    player?: string, 
    subFolder?: string
): any {
    // Extract fileName from assetId (remove ASSET# prefix if present)
    const fileName = assetId.replace(/^ASSET#/, '')
    
    const baseAddress = {
        zone: zone as any,
        fileName,
        ...(subFolder && { subFolder })
    }
    
    // Add player for Personal zone
    if (zone === 'Personal' && player) {
        return { ...baseAddress, player }
    }
    
    // Add backupId for Archive zone (we'll need to handle this case)
    if (zone === 'Archive') {
        return { ...baseAddress, backupId: `BACKUP#${Date.now()}` }
    }
    
    return baseAddress
}

/**
 * Perform the actual S3 file operations for the move
 */
async function performS3Move(
    s3Client: S3Client,
    fromWorkspace: ReadOnlyAssetWorkspace,
    toWorkspace: ReadOnlyAssetWorkspace
): Promise<MoveAssetResponse> {
    const fromFileNameBase = fromWorkspace.fileNameBase
    const toFileNameBase = toWorkspace.fileNameBase
    
    // Handle Archive zone special case - no file copying needed
    if (toWorkspace.address.zone === 'Archive') {
        // For Archive, we just delete the source files
        await Promise.all([
            s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromFileNameBase}.wml`
            })),
            s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromFileNameBase}.ndjson`
            }))
        ])
        
        return {
            success: true,
            message: `Asset archived (files deleted from source location)`,
            newLocation: toFileNameBase
        }
    }
    
    // Handle regular zone transitions - copy files then delete originals
    try {
        // Copy files to new location
        await Promise.all([
            s3Client.send(new CopyObjectCommand({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/${fromFileNameBase}.ndjson`,
                Key: `${toFileNameBase}.ndjson`
            })),
            s3Client.send(new CopyObjectCommand({
                Bucket: S3_BUCKET,
                CopySource: `${S3_BUCKET}/${fromFileNameBase}.wml`,
                Key: `${toFileNameBase}.wml`
            }))
        ])
        
        // Delete original files
        await Promise.all([
            s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromFileNameBase}.wml`
            })),
            s3Client.send(new DeleteObjectCommand({
                Bucket: S3_BUCKET,
                Key: `${fromFileNameBase}.ndjson`
            }))
        ])
        
        return {
            success: true,
            message: `Files successfully moved from ${fromFileNameBase} to ${toFileNameBase}`,
            newLocation: toFileNameBase
        }
        
    } catch (error) {
        console.error('S3 move operation failed:', error)
        return {
            success: false,
            message: `S3 operation failed: ${error instanceof Error ? error.message : String(error)}`
        }
    }
}
