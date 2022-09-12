import { DeleteObjectCommand, PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
// import sharp from "sharp"

import { streamToBuffer, streamToString } from '@tonylb/mtw-utilities/dist/stream'

import { dbRegister } from '../serialize/dbRegister'

import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB/index"

import { MessageBus, UploadURLMessage, UploadImageURLMessage, ParseWMLMessage } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import AssetWorkspace from "@tonylb/mtw-asset-workspace/dist/"
import { AssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace"

const { S3_BUCKET } = process.env;

//
// TODO: Add a tag verification step in upload handling, to prevent people from (e.g.) asking for a character
// link and uploading an Asset
//
export const uploadURLMessage = async ({ payloads, messageBus }: { payloads: UploadURLMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                const s3Object = `upload/${uuidv4()}.wml`
                const putCommand = new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: s3Object,
                    ContentType: 'text/plain'
                })
                const presignedOutput = await getSignedUrl(s3Client, putCommand, { expiresIn: 60 })
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'UploadURL',
                        url: presignedOutput,
                        s3Object
                    }
                })
            })
        )
    }
}

export const uploadImageURLMessage = async ({ payloads, messageBus }: { payloads: UploadImageURLMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                if (!['jpg', 'jpeg', 'jpe', 'gif', 'png'].includes(payload.fileExtension)) {
                    return
                }
                let contentType = 'image/png'
                switch(payload.fileExtension) {
                    case 'jpg':
                    case 'jpe':
                    case 'jpeg':
                        contentType = 'image/jpeg'
                        break
                    case 'gif':
                        contentType = 'image/gif'
                        break
                }
                const fileName = `${uuidv4()}.${payload.fileExtension}`
                const s3Object = `upload/images/${player}/${payload.tag}s/${fileName}`
                const putCommand = new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: s3Object,
                    ContentType: contentType
                })
                const presignedOutput = await getSignedUrl(s3Client, putCommand, { expiresIn: 60 })
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'UploadURL',
                        url: presignedOutput,
                        s3Object
                    }
                })
            })
        )
    }
}

export const handleImageUpload = ({ s3Client, messageBus }: { s3Client: S3Client, messageBus: MessageBus }) => async({ bucket, key }) => {
    const { dir: directory, name: fileName } = path.parse(key)
    const lastDirectory = directory.split('/').slice(-1)

    const { Body: contentStream } = await s3Client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: key
    }))
    const contents = await streamToBuffer(contentStream)
    
    const { width, height } = (lastDirectory && lastDirectory.length > 0 && lastDirectory[0] === 'Characters') ? { width: 200, height: 200 } : { width: 800, height: 600 }

    try {
        // const imageBuffer = await sharp(contents)
        //     .resize({ width, height, fit: sharp.strategy.fill })
        //     .toFormat('png')
        //     .toBuffer()
        // await s3Client.send(new PutObjectCommand({
        //     Bucket: bucket,
        //     Key: `images/${fileName}.png`,
        //     Body: imageBuffer
        // }))
        // await Promise.all([
        //     uploadResponse({
        //         uploadId: key,
        //         messageType: 'Success',
        //         operation: 'Upload'
        //     })
        // ])

    }
    catch {
        messageBus.send({
            type: 'UploadResponse',
            uploadId: key,
            messageType: 'Error'
        })
    }
    await s3Client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: key
    }))  
    return {}
}

const extractAddressFromParseWMLMessage = (value: ParseWMLMessage): AssetWorkspaceAddress => {
    const zone = value.zone
    if (zone === 'Personal') {
        return {
            zone,
            fileName: value.fileName,
            subFolder: value.subFolder,
            player: value.player
        }
    }
    else {
        return {
            zone,
            fileName: value.fileName,
            subFolder: value.subFolder
        }
    }
}

export const parseWMLMessage = async ({ payloads, messageBus }: { payloads: ParseWMLMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (!s3Client) {
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
            if (payload.zone !== 'Personal' || payload.player !== player) {
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'Error'
                    }
                })    
            }
            else {
                const assetWorkspace = new AssetWorkspace(extractAddressFromParseWMLMessage(payload))
            
                await assetWorkspace.loadJSON()
                await assetWorkspace.loadWMLFrom(payload.uploadName)
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
                        Bucket: S3_BUCKET,
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
