import { apiClient } from "../clients"
import { RemoveAssetMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"

export const removeAssetMessage = async ({ payloads, messageBus }: { payloads: RemoveAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ assetId }) => {
        await assetDB.deleteItem({
            AssetId: AssetKey(assetId),
            DataCategory: 'Meta::Asset'
        })
        console.log(`Received Remove Asset message for ${assetId}`)
    }))
}

export default removeAssetMessage
