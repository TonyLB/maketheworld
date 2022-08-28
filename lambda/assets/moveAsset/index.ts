import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

import { dbRegister } from '../serialize/dbRegister'
import { assetWorkspaceFromAssetId } from "../serialize/s3Assets"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import { MessageBus, MoveAssetMessage, MoveByAssetIdMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import AssetWorkspace from "@tonylb/mtw-asset-workspace"

const { S3_BUCKET } = process.env;

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
