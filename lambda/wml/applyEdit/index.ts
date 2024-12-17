import { StandardForm } from "@tonylb/mtw-wml/ts/standardize";
import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";
import eventBridgeClient from "@tonylb/mtw-utilities/ts/eventBridge"

export type ApplyEditArguments = {
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    RequestId: string;
    address: AssetWorkspaceAddress;
    schema: string;
}

export const applyEdit = async (args: ApplyEditArguments): Promise<Record<string, any>> => {
    const assetWorkspace = new AssetWorkspace(args.address)
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
        return {}
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
        await eventBridgeClient.send([{
            DetailType: 'Asset Edited',
            Detail: {
                AssetId: args.AssetId,
                RequestId: args.RequestId,
                schema: args.schema
            }
        }])
        
        return {}
    }
    catch (err) {
        console.log(`Merge Conflict`)
        await eventBridgeClient.send([{
            DetailType: 'Merge Conflict',
            Detail: {
                AssetId: args.AssetId,
                RequestId: args.RequestId
            }
        }])
        return {}
    }

}

export default applyEdit
