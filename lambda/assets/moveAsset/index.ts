import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { dbRegister } from '../serialize/dbRegister.js'
import { getAssets, assetWorkspaceFromAssetId } from "../serialize/s3Assets"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import ScopeMap from '../serialize/scopeMap.js'
import { isNormalAsset, isNormalImport, NormalAsset, NormalCharacter } from "@tonylb/mtw-wml/dist/normalize"
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
                    const toAssetWorkspace = new AssetWorkspace(to)
                    await fromAssetWorkspace.loadJSON()
                    if (fromAssetWorkspace.status.json !== 'Clean') {
                        return
                    }
                    const finalKey = toAssetWorkspace.fileNameBase
                    await Promise.all([
                        s3Client.send(new CopyObjectCommand({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${fromAssetWorkspace.fileNameBase}.json`,
                            Key: `${finalKey}.json`
                        })),
                        s3Client.send(new CopyObjectCommand({
                            Bucket: S3_BUCKET,
                            CopySource: `${S3_BUCKET}/${fromAssetWorkspace.fileNameBase}.wml`,
                            Key: `${finalKey}.wml`
                        })),
                        dbRegister({
                            fileName: `${finalKey}.wml`,
                            translateFile: `${finalKey}.json`,
                            importTree: [],
                            scopeMap: fromAssetWorkspace.namespaceIdToDB,
                            namespaceMap: {},
                            assets: fromAssetWorkspace.normal || {}
                        })
                    ])
                    await Promise.all([
                        s3Client.send(new DeleteObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${fromAssetWorkspace.fileNameBase}.wml`,
                        })),
                        s3Client.send(new DeleteObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${fromAssetWorkspace.fileNameBase}.json`,
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
        payloads.map(async (payload) => {
            const assetWorkspace: AssetWorkspace | undefined = await assetWorkspaceFromAssetId(payload.AssetId)
            if (assetWorkspace) {
                const fromPath = assetWorkspace.filePath
                const fileName = assetWorkspace.fileName
                if (fileName) {
                    messageBus.send({
                        type: 'MoveAsset',
                        fromPath,
                        fileName,
                        toPath: payload.toPath
                    })
                }
            }
        })
    )
}
