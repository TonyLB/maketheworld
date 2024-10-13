import { Schema } from "@tonylb/mtw-wml/ts/schema";
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize";
import assetAtomicLock from "../atomicLock";
import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace";
import { schemaToWML } from "@tonylb/mtw-wml/dist/schema";

export type ApplyEditArguments = {
    address: AssetWorkspaceAddress;
    schema: string;
}

export const applyEdit = async (args: ApplyEditArguments): Promise<Record<string, any>> => {
    const assetWorkspace = new AssetWorkspace(args.address)
    const loadPromise = assetWorkspace.loadJSON()
    
    //
    // While waiting on incoming ndjson, create an editStandardizer to be merged with it.
    //
    const editSchema = new Schema()
    editSchema.loadWML(args.schema)
    const editStandardizer = new Standardizer(editSchema.schema)

    //
    // TODO: Merge incoming changes with ndjson
    //
    await loadPromise
    if (!assetWorkspace.standard) {
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Error' })
        }
    }
    const baseStandardizer = new Standardizer()
    baseStandardizer.loadStandardForm(assetWorkspace.standard)
    let mergedStandardizer = new Standardizer()
    try {
        mergedStandardizer = baseStandardizer.merge(editStandardizer) as Standardizer
    }
    catch (err) {
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Error' })
        }
    }

    //
    // Write ndjson and wml
    //

    assetWorkspace.setJSON(mergedStandardizer.standardForm)
    await Promise.all([
        assetWorkspace.pushJSON(),
        assetWorkspace.pushWML()
    ])
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Success' })
    }
}

export default applyEdit
