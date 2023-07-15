import { nonLegacyEphemeraDB as ephemeraDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import { DecacheAssetMessage, MessageBus } from "../messageBus/baseClasses"
import { mergeIntoEphemera } from "../cacheAsset/perAsset";

export const decacheAssetMessage = async ({ payloads, messageBus }: { payloads: DecacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ assetId }) => {
        await Promise.all([
            mergeIntoEphemera(assetId, []),
            ephemeraDB.deleteItem({
                EphemeraId: AssetKey(assetId),
                DataCategory: 'Meta::Asset'
            }),
            ephemeraDB.deleteItem({
                EphemeraId: AssetKey(assetId),
                DataCategory: 'Meta::AssetNormalized'
            })
        ])
    }))
    messageBus.send({
        type: 'ReturnValue',
        body: { messageType: "Success" }
    })    
}

export default decacheAssetMessage
