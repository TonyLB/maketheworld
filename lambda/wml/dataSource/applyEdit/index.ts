import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import AssetWorkspace, { Zone } from "../../s3Storage/AssetWorkspace";
import internalCache from "../../internalCache";
import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"
import { appendChunk } from "../../s3Storage";
import { now } from "../../utilities/mockableTime";

export type ApplyEditArguments = {
    AssetId: AssetUUID;
    RequestId: string;
    schema: string;
    /**
     * If true, creates the asset if it doesn't exist or has no content.
     * Requires zone to be specified when creating.
     * Default: false (returns error if asset doesn't exist)
     */
    createIfNeeded?: boolean;
    /**
     * Zone to use when creating new assets (only used if createIfNeeded is true)
     */
    zone?: Zone;
}

export type ApplyEditSuccess = {
    success: true;
    schema: StandardForm;
}

export type ApplyEditConflict = {
    success: false;
    error: string;
}

export type ApplyEditResult = ApplyEditSuccess | ApplyEditConflict

/**
 * Apply an edit to an asset's content
 * 
 * This function validates the edit request and delegates to the storage
 * system's appendChunk operation, which handles:
 * - Loading current content (with self-repair if needed)
 * - Merging the edit
 * - Writing chunk, manifest, and materialized views
 * 
 * Business logic responsibilities:
 * - Validate AssetId format
 * - Determine zone (from existing asset or args)
 * - Extract authoringPlayer from connection
 * - Map errors to domain-appropriate messages
 * 
 * The caller (DataSource) is responsible for:
 * - Publishing Content Update or Merge Conflict events via streamEvent
 */
export const applyEdit = async (args: ApplyEditArguments): Promise<ApplyEditResult> => {
    // Validate AssetId format
    if (!isSchemaAssetUUID(args.AssetId)) {
        return {
            success: false,
            error: 'Invalid AssetId format'
        }
    }

    // Determine zone for the edit
    let zone: Zone
    
    if (args.zone) {
        // Zone explicitly provided (for new assets)
        zone = args.zone
    } else {
        // Look up existing asset to get zone
        const assetWorkspace = await AssetWorkspace.fromUUID(args.AssetId)
        
        if (!assetWorkspace) {
            return {
                success: false,
                error: args.createIfNeeded 
                    ? 'Asset not found and zone not specified for creation'
                    : 'Asset not found'
            }
        }
        
        zone = assetWorkspace.zone
    }
    
    // Extract authoringPlayer metadata for chunk provenance
    const authoringPlayer = await internalCache.Connection.get('player')
    
    // Validate player is available for Draft/Personal zones (required for AssetWorkspace)
    if ((zone === 'Draft' || zone === 'Personal') && !authoringPlayer) {
        return {
            success: false,
            error: `Player is required for ${zone} zone operations. Connection not authenticated.`
        }
    }
    
    // Delegate to storage system
    const result = await appendChunk({
        assetId: args.AssetId,
        chunkWML: args.schema,  // Edit WML with Replace/Remove tags
        timestamp: now(),
        zone,
        authoringPlayer,
        createIfNeeded: args.createIfNeeded || false
    })
    
    // Map storage result to applyEdit result
    if (result.success) {
        return {
            success: true,
            schema: result.mergedContent
        }
    } else {
        // Map error types to appropriate messages
        console.log(`Edit failed: ${result.error}`)
        return {
            success: false,
            error: result.error
        }
    }
}

export default applyEdit


