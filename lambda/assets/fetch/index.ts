import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import { splitType } from '@tonylb/mtw-utilities/ts/types'
import { FetchAssetMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { MessageBus } from "../messageBus/baseClasses"
import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { assetWorkspaceFromAssetId } from "../utilities/assets"

const createFetchLink = async ({ PlayerName, fileName, AssetId }: { PlayerName: string; fileName?: string; AssetId?: string }) => {
    // let derivedFileName: string = `Personal/${PlayerName}/${fileName}`
    if (AssetId) {
        if (AssetId === 'ASSET#draft') {
            const assetWorkspace = new ReadOnlyAssetWorkspace({
                zone: 'Draft',
                player: PlayerName
            })
            return await assetWorkspace.presignedURL()
        }
        const DataCategory = (splitType(AssetId)[0] === 'CHARACTER') ? 'Meta::Character' : 'Meta::Asset'
        const { address } = (await assetDB.getItem<{ address: AssetWorkspaceAddress }>({
            Key: {
                AssetId,
                DataCategory
            },
            ProjectionFields: ['address']
        })) || {}
        if (address) {
            const assetWorkspace = new ReadOnlyAssetWorkspace(address)
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