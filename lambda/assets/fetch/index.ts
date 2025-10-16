import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import { splitType } from '@tonylb/mtw-utilities/ts/types'
import { FetchAssetMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { MessageBus } from "../messageBus/baseClasses"
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { assetWorkspaceFromAssetId } from "../utilities/assets"

const createFetchLink = async ({ PlayerName, fileName, AssetId }: { PlayerName: string; fileName?: string; AssetId?: string }) => {
    if (AssetId) {
        if (AssetId === 'ASSET#draft') {
            // Special case: Draft zone workspace for player (no specific asset)
            const assetWorkspace = new ReadOnlyAssetWorkspace({
                zone: 'Draft',
                player: PlayerName
            })
            return await assetWorkspace.presignedURL()
        }
        
        // Phase 1B: Use fromUUID for regular asset lookups
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
                    AssetId: payload.AssetId
                })
            ])
            messageBus.send({
                type: 'ReturnValue',
                body: { messageType: "FetchURL", url: presignedURL }
            })    
        }))
    }
}

export default fetchAssetMessage