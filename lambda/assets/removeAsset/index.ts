import { apiClient } from "../clients"
import { RemoveAssetMessage, MessageBus } from "../messageBus/baseClasses"

import internalCache from '../internalCache'

export const removeAssetMessage = async ({ payloads, messageBus }: { payloads: RemoveAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async ({ AssetId }) => {
        console.log(`Received Remove Asset message for ${AssetId}`)
    }))
}

export default removeAssetMessage
