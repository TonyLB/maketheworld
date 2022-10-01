import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

import { dbRegister } from '../serialize/dbRegister'
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import { MessageBus, MoveAssetMessage, MoveByAssetIdMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import AssetWorkspace, { AssetWorkspaceAddress, isAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/"
import { splitType } from "@tonylb/mtw-utilities/dist/types"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

const { S3_BUCKET } = process.env;

const assetWorkspaceFromAssetId = async (AssetId: string): Promise<AssetWorkspace | undefined> => {
    const [type] = splitType(AssetId)
    let dataCategory = 'Meta::Asset'
    switch(type) {
        case 'CHARACTER':
            dataCategory = 'Meta::Character'
            break
    }
    const address = (await assetDB.getItem<AssetWorkspaceAddress>({
        AssetId,
        DataCategory: dataCategory,
        ProjectionFields: ['fileName', '#zone', 'player', 'subFolder'],
        ExpressionAttributeNames: {
            '#zone': 'zone'
        }
    })) || {}
    if (!isAssetWorkspaceAddress(address)) {
        return undefined
    }
    return new AssetWorkspace(address)
}
export const moveAssetMessage = async ({ payloads, messageBus }: { payloads: MoveAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                const { from, to } = payload
                await asyncSuppressExceptions(async () => {
                    const fromAssetWorkspace = new AssetWorkspace(from)
                    const fileNameBase = fromAssetWorkspace.fileNameBase
                    const toAssetWorkspace = new AssetWorkspace(to)
                    await fromAssetWorkspace.loadJSON()
                    if (fromAssetWorkspace.status.json !== 'Clean') {
                        return
                    }
                    fromAssetWorkspace.address = toAssetWorkspace.address
                    const finalKey = toAssetWorkspace.fileNameBase
                    await Promise.all([
                        s3Client.send(new CopyObjectCommand({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${fileNameBase}.json`,
                            Key: `${finalKey}.json`
                        })),
                        s3Client.send(new CopyObjectCommand({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${fileNameBase}.wml`,
                            Key: `${finalKey}.wml`
                        })),
                        dbRegister(fromAssetWorkspace)
                    ])
                    await Promise.all([
                        s3Client.send(new DeleteObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${fileNameBase}.wml`,
                        })),
                        s3Client.send(new DeleteObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${fileNameBase}.json`,
                        }))
                    ])
            
                })
                if ((to.zone === 'Library' || from.zone === 'Library') && !(to.zone === 'Library' && from.zone === 'Library')) {
                    messageBus.send({ type: 'LibraryUpdate' })
                }
                if (!(to.zone === 'Personal' && from.zone === 'Personal' && to.player === from.player)) {
                    if (from.zone === 'Personal') {
                        messageBus.send({
                            type: 'PlayerLibraryUpdate',
                            player: from.player
                        })
                    }
                    if (to.zone === 'Personal') {
                        messageBus.send({
                            type: 'PlayerLibraryUpdate',
                            player: to.player
                        })
                    }
                }
            })
        )
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Success' }
        })
    }
    else {
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Error' }
        })
    }
}

export const moveAssetByIdMessage = async ({ payloads, messageBus }: { payloads: MoveByAssetIdMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(
        payloads.map(async ({ toZone, player, AssetId }) => {
            const assetWorkspace: AssetWorkspace | undefined = await assetWorkspaceFromAssetId(AssetId)
            if (assetWorkspace) {
                const fileName = assetWorkspace.fileName
                if (fileName) {
                    messageBus.send({
                        type: 'MoveAsset',
                        from: assetWorkspace.address,
                        to: (toZone === 'Personal') ? {
                            fileName: assetWorkspace.address.fileName,
                            subFolder: assetWorkspace.address.subFolder,
                            zone: toZone,
                            player: player || ''
                        } : {
                            fileName: assetWorkspace.address.fileName,
                            subFolder: assetWorkspace.address.subFolder,
                            zone: toZone
                        }
                    })
                }
            }
        })
    )
}
