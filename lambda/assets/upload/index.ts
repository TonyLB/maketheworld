import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from 'uuid'

import { dbRegister } from '../serialize/dbRegister'

import { MessageBus, UploadURLMessage, ParseWMLMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import { formatImage } from "../formatImage"
import { ParseWMLAPIImage } from "@tonylb/mtw-interfaces/dist/asset"
import { isNormalAsset } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { assetWorkspaceFromAssetId } from "../utilities/assets"
import { ebClient } from "../clients"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { isEphemeraCharacterId } from "@tonylb/mtw-interfaces/dist/baseClasses"
import AssetWorkspace from "@tonylb/mtw-asset-workspace/dist/index"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

const { UPLOAD_BUCKET } = process.env;

const presignedUploadURL = async ({ key, s3Client, prefix, contentType, fileExtension }: { key?: string; s3Client: S3Client, prefix: string, contentType: string, fileExtension: string }): Promise<{ key?: string; s3Object: string; presignedOutput: string }> => {
    const s3Object = `${prefix}-${uuidv4()}.${fileExtension}`
    const putCommand = new PutObjectCommand({
        Bucket: UPLOAD_BUCKET,
        Key: s3Object,
        ContentType: contentType
    })
    const presignedOutput = await getSignedUrl(s3Client, putCommand, { expiresIn: 60 })
    return {
        key,
        s3Object,
        presignedOutput
    }
}

//
// TODO: Add a tag verification step in upload handling, to prevent people from (e.g.) asking for a character
// link and uploading an Asset
//
export const uploadURLMessage = async ({ payloads, messageBus }: { payloads: UploadURLMessage[], messageBus: MessageBus }): Promise<void> => {
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                const [{ s3Object, presignedOutput }, ...images] = await Promise.all([
                    presignedUploadURL({
                        s3Client,
                        prefix: payload.assetType === 'Asset' ? 'ASSET' : 'CHARACTER',
                        fileExtension: 'wml',
                        contentType: 'text/plain'
                    }),
                    ...(payload.images
                        .map(({ contentType, ...rest }) => {
                            switch(contentType) {
                                case 'image/jpeg':
                                case 'image/jpe':
                                case 'image/jpg':
                                case 'image/gif':
                                case 'image/png':
                                case 'image/bmp':
                                case 'image/tiff':
                                case 'image/tif':
                                    return {
                                        contentType,
                                        fileExtension: contentType.slice(6),
                                        ...rest
                                    }
                                default: return { contentType, fileExtension: undefined, ...rest }
                            }
                        }))
                        .filter(({ fileExtension }) => (fileExtension))
                        .map(({ key, contentType, fileExtension = '' }) => (presignedUploadURL({ s3Client, prefix: 'IMAGE', key, contentType, fileExtension })))
                ])
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'UploadURL',
                        url: presignedOutput,
                        s3Object,
                        images: images.filter(({ key }) => (key))
                    }
                })
            })
        )
    }
}

export const parseWMLMessage = async ({ payloads, messageBus }: { payloads: ParseWMLMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (!s3Client || !player) {
        messageBus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                message: 'Assets handler failed to deduce player and s3Client'
            }
        })
        return
    }
    await Promise.all(
        payloads.map(async (payload) => (asyncSuppressExceptions(async () => {
            let assetWorkspace = await assetWorkspaceFromAssetId(payload.AssetId, isEphemeraCharacterId(payload.AssetId))
            if (!(assetWorkspace && assetWorkspace.address.zone === 'Personal' && assetWorkspace.address.player === player)) {
                const [tag, key] = splitType(payload.AssetId)
                if (payload.create && ['ASSET', 'CHARACTER'].includes(tag)) {
                    assetWorkspace = new AssetWorkspace({
                        zone: 'Personal',
                        player,
                        subFolder: tag === 'ASSET' ? 'Assets' : 'Characters',
                        fileName: key
                    })
                }
            }
            else {
                await assetWorkspace.loadJSON()
            }
            if (assetWorkspace) {
                assetWorkspace.setWorkspaceLookup(assetWorkspaceFromAssetId)
                const fileType = Object.values(assetWorkspace.normal || {}).find(isNormalAsset) ? 'Asset' : 'Character'
                const imageFiles = (await Promise.all([
                    assetWorkspace.loadWMLFrom(payload.uploadName, true),
                    ...((payload.images || []).map(async ({ key, fileName }) => {
                        const final = await formatImage({ fromFileName: fileName, width: fileType === 'Asset' ? 1200: 200, height: fileType === 'Asset' ? 800 : 200 })
                        return { key, fileName: final }
                    }))
                ])).slice(1) as ParseWMLAPIImage[]
                if (imageFiles.length) {
                    assetWorkspace.status.json = 'Dirty'
                    imageFiles.forEach(({ key, fileName }) => {
                        (assetWorkspace as AssetWorkspace).properties[key] = { fileName }
                    })
                }
                if (assetWorkspace.status.json !== 'Clean') {
                    await Promise.all([
                        assetWorkspace.pushJSON(),
                        assetWorkspace.pushWML(),
                        dbRegister(assetWorkspace)
                    ])
                    await ebClient.send(new PutEventsCommand({
                        Entries: [{
                            EventBusName: process.env.EVENT_BUS_NAME,
                            Source: 'mtw.coordination',
                            DetailType: 'Cache Asset',
                            Detail: JSON.stringify({
                                ...assetWorkspace.address,
                                updateOnly: true
                            })
                        }]
                    }))            
                }
                else {
                    await assetWorkspace.pushWML()
                }

                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: UPLOAD_BUCKET,
                        Key: payload.uploadName
                    }))  
                }
                catch {}
            
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'ParseWML',
                        images: imageFiles
                    }
                })
            }
            else {
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'Error',
                        message: `Asset (${payload.AssetId}) not legal target`
                    }
                })
                return
            }
        }, async () => {
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'Error',
                    message: 'Unknown parseWML error'
                }
            })
        })))
    )
}
