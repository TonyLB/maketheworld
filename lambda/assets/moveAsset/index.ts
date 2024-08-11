import { CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

import { dbRegister } from '../serialize/dbRegister'
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"
import { MessageBus, MoveAssetMessage, MoveByAssetIdMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { assetWorkspaceFromAssetId } from "../utilities/assets"
import { SerializableStandardAsset, SerializableStandardCharacter } from "@tonylb/mtw-wml/ts/standardize/baseClasses"

const { S3_BUCKET } = process.env;

export const moveAssetMessage = async ({ payloads, messageBus }: { payloads: MoveAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                const { from, to, AssetId } = payload
                await asyncSuppressExceptions(async () => {
                    const fromAssetWorkspace = new ReadOnlyAssetWorkspace(from)
                    const fileNameBase = fromAssetWorkspace.fileNameBase
                    const toAssetWorkspace = new ReadOnlyAssetWorkspace(to)
                    await fromAssetWorkspace.loadJSON()
                    if (fromAssetWorkspace.status.json !== 'Clean') {
                        return
                    }
                    fromAssetWorkspace.address = toAssetWorkspace.address
                    if (toAssetWorkspace.address.zone !== 'Archive') {
                        const finalKey = toAssetWorkspace.fileNameBase
                        await Promise.all([
                            s3Client.send(new CopyObjectCommand({
                                Bucket: S3_BUCKET,
                                CopySource: `${S3_BUCKET}/${fileNameBase}.ndjson`,
                                Key: `${finalKey}.ndjson`
                            })),
                            s3Client.send(new CopyObjectCommand({
                                Bucket: S3_BUCKET,
                                CopySource: `${S3_BUCKET}/${fileNameBase}.wml`,
                                Key: `${finalKey}.wml`
                            })),
                            dbRegister(fromAssetWorkspace)
                        ])
                    }
                    else {
                        fromAssetWorkspace.standard = {
                            key: AssetId.split('#').slice(-1)[0],
                            tag: AssetId.split('#')[0] === 'CHARACTER' ? 'Character' : 'Asset',
                            byId: {},
                            metaData: []
                        }
                        await dbRegister(fromAssetWorkspace)
                    }
                    await Promise.all([
                        s3Client.send(new DeleteObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${fileNameBase}.wml`,
                        })),
                        s3Client.send(new DeleteObjectCommand({
                            Bucket: S3_BUCKET,
                            Key: `${fileNameBase}.ndjson`,
                        }))
                    ])
            
                    if ((to.zone === 'Library' || from.zone === 'Library') && !(to.zone === 'Library' && from.zone === 'Library')) {
                        //
                        // TODO: Add set method to internalCache.Library, and use it (as below) to clear or update things
                        // that are being moved
                        //
                        if (from.zone === 'Library') {
                            const rootNodes = fromAssetWorkspace.rootNodes
                            internalCache.Library.set({
                                Assets: rootNodes.filter((value): value is SerializableStandardAsset => (value.tag === 'Asset')).reduce<Record<string, undefined>>((previous, { key }) => ({ ...previous, [key]: undefined }), {}),
                                Characters: rootNodes.filter((value): value is SerializableStandardCharacter => (value.tag === 'Character')).reduce<Record<string, undefined>>((previous, { key }) => ({ ...previous, [key]: undefined }), {}),
                            })
                        }
                        messageBus.send({ type: 'LibraryUpdate' })
                    }
                    if (!(to.zone === 'Personal' && from.zone === 'Personal' && to.player === from.player)) {
                        if (from.zone === 'Personal') {
                            const rootNodes = fromAssetWorkspace.rootNodes
                            internalCache.PlayerLibrary.set(from.player, {
                                Assets: rootNodes.filter((value): value is SerializableStandardAsset => (value.tag === 'Asset')).reduce<Record<string, undefined>>((previous, { key }) => ({ ...previous, [key]: undefined }), {}),
                                Characters: rootNodes.filter((value): value is SerializableStandardCharacter => (value.tag === 'Character')).reduce<Record<string, undefined>>((previous, { key }) => ({ ...previous, [key]: undefined }), {}),
                            })
                            messageBus.send({
                                type: 'PlayerInfo',
                                player: from.player
                            })
                        }
                        //
                        // Library updates for moving *to* a player are automatically handled in dbRegister
                        //
                        if (to.zone === 'Personal') {
                            messageBus.send({
                                type: 'PlayerInfo',
                                player: to.player
                            })
                        }
                    }
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
        payloads.map(async ({ toZone, player, backupId, AssetId }) => {
            const assetWorkspace: ReadOnlyAssetWorkspace | undefined = await assetWorkspaceFromAssetId(AssetId)
            if (assetWorkspace) {
                const { address, fileName } = assetWorkspace
                if (address.zone === 'Draft') {
                    return
                }
                if (toZone === 'Archive') {
                    if (!backupId) {
                        return
                    }
                    messageBus.send({
                        type: 'MoveAsset',
                        AssetId,
                        from: address,
                        to: {
                            zone: toZone,
                            backupId: backupId || ''
                        }
                    })

                }
                else if (fileName && address.zone !== 'Archive') {
                    messageBus.send({
                        type: 'MoveAsset',
                        AssetId,
                        from: address,
                        to: (toZone === 'Personal') ? {
                            fileName: address.fileName,
                            subFolder: address.subFolder,
                            zone: toZone,
                            player: player || ''
                        } : {
                            fileName: address.fileName,
                            subFolder: address.subFolder,
                            zone: toZone
                        }
                    })
                }
            }
        })
    )
}
