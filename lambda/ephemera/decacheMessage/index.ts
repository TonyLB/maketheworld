import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import { DecacheAssetMessage, MessageBus } from "../messageBus/baseClasses"
import { mergeIntoEphemera } from "../cacheAsset/perAsset";
import setEdges from "@tonylb/mtw-utilities/dist/graphStorage/update/setEdges";
import internalCache from "../internalCache";
import { graphStorageDB } from "../dependentMessages/graphCache";
import GraphUpdate from "@tonylb/mtw-utilities/dist/graphStorage/update";

export const decacheAssetMessage = async ({ payloads, messageBus }: { payloads: DecacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ assetId }) => {
        const graphUpdate = new GraphUpdate({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })
        graphUpdate.setEdges([{ itemId: AssetKey(assetId), edges: [], options: { direction: 'back' } }])
        await Promise.all([
            mergeIntoEphemera(assetId, [], graphUpdate),
            ephemeraDB.deleteItem({
                EphemeraId: AssetKey(assetId),
                DataCategory: 'Meta::Asset'
            })
        ])
        await graphUpdate.flush()
    }))
    messageBus.send({
        type: 'ReturnValue',
        body: { messageType: "Success" }
    })    
}

export default decacheAssetMessage
