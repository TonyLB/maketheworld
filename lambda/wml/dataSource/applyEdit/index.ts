import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import AssetWorkspace from "@tonylb/mtw-asset-workspace";
import internalCache from "../../internalCache";
import { isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"

export type ApplyEditArguments = {
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    RequestId: string;
    schema: string;
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

    const assetWorkspace = await AssetWorkspace.fromUUID(args.AssetId)
    if (!assetWorkspace) {
        return {
            success: false,
            error: 'Asset not found'
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
    if (!assetWorkspace.standard) {
        return {
            success: false,
            error: 'Asset content not found'
        }
    }

    try {
        const mergedStandard = assetWorkspace.standard.merge(editStandard)

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


