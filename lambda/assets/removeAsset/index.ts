import { RemoveAssetMessage, MessageBus } from "../messageBus/baseClasses"

import { legacyAssetDB as assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import internalCache from "../internalCache"
import { healPlayer } from "../selfHealing/player"

export const removeAssetMessage = async ({ payloads, messageBus }: { payloads: RemoveAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ assetId }) => {
        const { address } = await internalCache.Meta.get(`ASSET#${assetId}`)
        await Promise.all([
            assetDB.deleteItem({
                AssetId: AssetKey(assetId),
                DataCategory: 'Meta::Asset'
            }),
            ...(address && address.zone === 'Personal' ? [healPlayer(address.player)] : [])
        ])
        console.log(`Received Remove Asset message for ${assetId}`)
    }))
}

export default removeAssetMessage
