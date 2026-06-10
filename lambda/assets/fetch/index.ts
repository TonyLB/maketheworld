import { FetchAssetMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { MessageBus } from "../messageBus/baseClasses"
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { AssetUUID, isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"

const createFetchLink = async ({ PlayerName, fileName, AssetId }: { PlayerName: string; fileName?: string; AssetId?: AssetUUID }) => {
    if (AssetId) {
        const assetWorkspace = await ReadOnlyAssetWorkspace.fromUUID(AssetId)
        if (assetWorkspace) {
            return await assetWorkspace.forceDefault().then(() => (assetWorkspace.presignedURL()))
        }
    }
    return undefined

}

export const fetchAssetMessage = async ({ payloads, messageBus }: { payloads: FetchAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    if (player) {
        await Promise.all(payloads.map(async (payload) => {
            const [presignedURL] = await Promise.all([
                createFetchLink({
                    PlayerName: player,
                    fileName: payload.fileName,
                    AssetId: (typeof payload.AssetId === 'string' && isSchemaAssetUUID(payload.AssetId)) ? payload.AssetId : undefined
                })
            ])
            messageBus.publish({
                type: 'ReturnValue',
                body: { messageType: "FetchURL", url: presignedURL }
            })    
        }))
    }
}

export default fetchAssetMessage