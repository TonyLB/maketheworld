import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from 'uuid'

import { dbRegister } from '../serialize/dbRegister'

import { MessageBus, UploadURLMessage, ParseWMLMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import AssetWorkspace from "@tonylb/mtw-asset-workspace/dist/"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"
import { formatImage } from "../formatImage"
import { ParseWMLAPIImage } from "@tonylb/mtw-interfaces/dist/asset"
import { isNormalAsset } from "@tonylb/mtw-wml/dist/normalize/baseClasses"
import { assetWorkspaceFromAssetId } from "../utilities/assets"

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
                messageType: 'Error'
            }
        })
        return
    }
    await Promise.all(
        payloads.map(async (payload) => (asyncSuppressExceptions(async () => {
            console.log(`Getting assetWorkspace for: ${payload.AssetId}`)
            const assetWorkspace = await assetWorkspaceFromAssetId(payload.AssetId, true)
            console.log(`assetWorkspace: ${JSON.stringify(assetWorkspace, null, 4)}`)
            //
            // TODO: If assetWorkspace does not exist, check "create" property for address at which
            // to create it.
            //         
            if (!(assetWorkspace && assetWorkspace.address.zone === 'Personal' && assetWorkspace.address.player === player)) {
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'Error'
                    }
                })
            }
            else {
                await assetWorkspace.loadJSON()
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
                        assetWorkspace.properties[key] = { fileName }
                    })
                }
                if (assetWorkspace.status.json !== 'Clean') {
                    await Promise.all([
                        assetWorkspace.pushJSON(),
                        assetWorkspace.pushWML(),
                        dbRegister(assetWorkspace)
                    ])
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
                        messageType: 'Success',
                    }
                })
            }
        }, async () => {
            messageBus.send({
                type: 'ReturnValue',
                body: {
                    messageType: 'Error'
                }
            })
        })))
    )
}
