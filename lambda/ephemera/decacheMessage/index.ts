import { ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import { DecacheAssetMessage, MessageBus } from "../messageBus/baseClasses"
import { mergeIntoEphemera } from "../cacheAsset/perAsset";
import setEdges from "@tonylb/mtw-utilities/dist/graphStorage/update/setEdges";
import internalCache from "../internalCache";
import { graphStorageDB } from "../dependentMessages/graphCache";

export const decacheAssetMessage = async ({ payloads, messageBus }: { payloads: DecacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ assetId }) => {
        await (setEdges({ internalCache: internalCache._graphCache, dbHandler: graphStorageDB })([{ itemId: AssetKey(assetId), edges: [], options: { direction: 'back' } }]))
        await Promise.all([
            mergeIntoEphemera(assetId, []),
            ephemeraDB.deleteItem({
                EphemeraId: AssetKey(assetId),
                DataCategory: 'Meta::Asset'
            })
        ])
    }))
    messageBus.send({
        type: 'ReturnValue',
        body: { messageType: "Success" }
    })    
}

export default decacheAssetMessage
