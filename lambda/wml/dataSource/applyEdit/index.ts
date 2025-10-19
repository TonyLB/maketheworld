import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import AssetWorkspace, { Zone } from "../../s3Storage/AssetWorkspace";
import internalCache from "../../internalCache";
import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"

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
 * This function:
 * 1. Loads the current asset content from S3 (NDJSON)
 * 2. Parses the incoming edit schema (WML with Replace/Remove tags)
 * 3. Merges the edit with the current content
 * 4. Writes back both WML and NDJSON formats to S3
 * 5. Returns success or conflict result
 * 
 * The caller (DataSource) is responsible for:
 * - Publishing Content Update or Merge Conflict events via streamEvent
 */
export const applyEdit = async (args: ApplyEditArguments): Promise<ApplyEditResult> => {
    if (!isSchemaAssetUUID(args.AssetId)) {
        return {
            success: false,
            error: 'Invalid AssetId format'
        }
    }

    // Try to load existing asset
    let assetWorkspace = await AssetWorkspace.fromUUID(args.AssetId)
    
    // Handle asset not found
    if (!assetWorkspace) {
        if (args.createIfNeeded && args.zone) {
            // Create new asset workspace in specified zone
            assetWorkspace = new AssetWorkspace(args.AssetId, args.zone)
        } else {
            return {
                success: false,
                error: args.createIfNeeded 
                    ? 'Asset not found and zone not specified for creation'
                    : 'Asset not found'
            }
        }
    }
    
    const loadPromise = assetWorkspace.loadJSON()
    
    //
    // While waiting on incoming ndjson, create an editStandardizer to be merged with it.
    //
    const editStandard = new StandardForm(args.schema)

    //
    // Merge incoming changes with ndjson
    //
    await loadPromise
    
    // Get existing content or create empty StandardForm if createIfNeeded is true
    let existingStandard = assetWorkspace.standard
    
    if (!existingStandard || existingStandard._components.length === 0) {
        if (args.createIfNeeded) {
            // Start with empty StandardForm - edit will become initial content
            const assetKey = args.AssetId.replace('ASSET#', '')
            existingStandard = new StandardForm(assetKey)
        } else {
            return {
                success: false,
                error: 'Asset content not found'
            }
        }
    }

    try {
        const mergedStandard = existingStandard.merge(editStandard)

        console.log(`Merged standard: ${JSON.stringify(mergedStandard.toJSON(), null, 4)}`)

        //
        // Write ndjson and wml
        //
    
        assetWorkspace.setJSON(mergedStandard)
        await Promise.all([
            assetWorkspace.pushJSON(),
            assetWorkspace.pushWML()
        ])
        
        return {
            success: true,
            schema: mergedStandard
        }
    }
    catch (err) {
        console.log(`Merge Conflict: ${err instanceof Error ? err.message : String(err)}`)
        return {
            success: false,
            error: err instanceof Error ? err.message : 'Unknown merge conflict'
        }
    }
}

export default applyEdit


