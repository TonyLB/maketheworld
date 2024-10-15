import { Schema } from "@tonylb/mtw-wml/ts/schema";
import { Standardizer } from "@tonylb/mtw-wml/ts/standardize";
import AssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace";
import { ebClient } from "../clients";
import { PutEventsCommand } from "@aws-sdk/client-eventbridge";

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
    const editSchema = new Schema()
    editSchema.loadWML(args.schema)
    const editStandardizer = new Standardizer(editSchema.schema)
    console.log(`editStandardizer: ${JSON.stringify(editStandardizer.standardForm, null, 4)}`)

    //
    // Merge incoming changes with ndjson
    //
    await loadPromise
    if (!assetWorkspace.standard) {
        return {}
    }
    const baseStandardizer = new Standardizer()
    baseStandardizer.loadStandardForm(assetWorkspace.standard)
    console.log(`baseStandardizer: ${JSON.stringify(baseStandardizer.standardForm, null, 4)}`)
    let mergedStandardizer = new Standardizer()
    try {
        mergedStandardizer = baseStandardizer.merge(editStandardizer) as Standardizer
    }
    catch (err) {
        console.log(`Merge Conflict`)
        await ebClient.send(new PutEventsCommand({
            Entries: [{
                EventBusName: process.env.EVENT_BUS_NAME,
                Source: 'mtw.wml',
                DetailType: 'Merge Conflict',
                Detail: JSON.stringify({
                    AssetId: args.AssetId,
                    RequestId: args.RequestId
                })
            }]
        }))
        return {}
    }
    console.log(`Merged standard: ${JSON.stringify(mergedStandardizer.standardForm, null, 4)}`)

    //
    // Write ndjson and wml
    //

    assetWorkspace.setJSON(mergedStandardizer.standardForm)
    await Promise.all([
        assetWorkspace.pushJSON(),
        assetWorkspace.pushWML()
    ])
    await ebClient.send(new PutEventsCommand({
        Entries: [{
            EventBusName: process.env.EVENT_BUS_NAME,
            Source: 'mtw.wml',
            DetailType: 'Asset Edited',
            Detail: JSON.stringify({
                AssetId: args.AssetId,
                RequestId: args.RequestId,
                schema: args.schema
            })
        }]
    }))
    
    return {}
}

export default applyEdit
