import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
// import sharp from "sharp"

import { streamToBuffer } from '@tonylb/mtw-utilities/dist/stream'

import { getAssets } from '../serialize/s3Assets'
import { putTranslateFile } from "../serialize/translateFile.js"
import ScopeMap from "../serialize/scopeMap.js"
import { dbRegister } from '../serialize/dbRegister.js'
import { cacheAsset } from "../cache/index.js"

import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB/index"

import { MessageBus, UploadURLMessage } from "../messageBus/baseClasses"
import { isNormalAsset, isNormalCharacter, isNormalImport, NormalAsset, NormalCharacter, NormalItem } from "../wml/normalize.js"
import internalCache from "../internalCache"

const { S3_BUCKET } = process.env;

//
// TODO: Add a tag verification step in upload handling, to prevent people from (e.g.) asking for a character
// link and uploading an Asset
//
export const createUploadLink = ({ s3Client }) => async ({ PlayerName, fileName, tag = 'Character', RequestId }) => {
    const putCommand = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `upload/${PlayerName}/${tag}s/${fileName}`,
        ContentType: 'text/plain'
    })
    const [presignedOutput] = await Promise.all([
        getSignedUrl(s3Client, putCommand, { expiresIn: 60 }),
        assetDB.putItem({
            AssetId: `UPLOAD#${PlayerName}/${tag}s/${fileName}`,
            DataCategory: `PLAYER#${PlayerName}`,
            RequestId
        })
    ])
    return presignedOutput
}

export const uploadURLMessage = async ({ payloads, messageBus }: { payloads: UploadURLMessage[], messageBus: MessageBus }): Promise<void> => {
    const player = await internalCache.Connection.get('player')
    const s3Client = await internalCache.Connection.get('s3Client')
    if (s3Client) {
        await Promise.all(
            payloads.map(async (payload) => {
                const putCommand = new PutObjectCommand({
                    Bucket: S3_BUCKET,
                    Key: `upload/${player}/${payload.tag}s/${payload.fileName}`,
                    ContentType: 'text/plain'
                })
                const [presignedOutput] = await Promise.all([
                    getSignedUrl(s3Client, putCommand, { expiresIn: 60 }),
                    assetDB.putItem({
                        AssetId: `UPLOAD#${player}/${payload.tag}s/${payload.fileName}`,
                        DataCategory: `PLAYER#${player}`,
                        RequestId: payload.uploadRequestId
                    })
                ])
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'UploadURL',
                        url: presignedOutput
                    }
                })
            })
        )
    }
}

export const createUploadImageLink = ({ s3Client }) => async ({ PlayerName, fileExtension, tag = 'Character', RequestId }) => {
    if (!['jpg', 'jpeg', 'jpe', 'png'].includes(fileExtension)) {
        return null
    }
    let contentType = 'image/png'
    switch(fileExtension) {
        case 'jpg':
        case 'jpe':
        case 'jpeg':
            contentType = 'image/jpeg'
            break
        case 'gif':
            contentType = 'image/gif'
            break
    }
    const fileName = `${uuidv4()}.${fileExtension}`
    const putCommand = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `upload/images/${PlayerName}/${tag}s/${fileName}`,
        ContentType: contentType
    })
    const [presignedOutput] = await Promise.all([
        getSignedUrl(s3Client, putCommand, { expiresIn: 60 }),
        assetDB.putItem({
            AssetId: `UPLOAD#images/${PlayerName}/${tag}s/${fileName}`,
            DataCategory: `PLAYER#${PlayerName}`,
            RequestId
        })
    ])
    return presignedOutput
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

export const handleUpload = ({ s3Client, messageBus }: { s3Client: S3Client, messageBus: MessageBus }) => async ({ bucket, key }) => {
    const objectNameItems = key.split('/').slice(1)
    const objectPrefix = objectNameItems.length > 1
        ? `${objectNameItems.slice(0, -1).join('/')}/`
        : ''

    if (objectNameItems[0] === 'images') {
        return handleImageUpload({ s3Client })({ bucket, key })
    }
    const assetWorkspace = await getAssets(s3Client, key)
    if (!assetWorkspace) {
        return {}
    }

    if (assetWorkspace.isMatched()) {
        try {
            const asset = Object.values(assetWorkspace.normalize()).find((item) => (isNormalAsset(item) || isNormalCharacter(item))) as NormalAsset | NormalCharacter | undefined
            if (asset && asset.key) {
                const fileName = `Personal/${objectPrefix}${asset.fileName}.wml`
                let translateFile
                const scopeMap = new ScopeMap({})
                if (isNormalAsset(asset) && !asset.instance) {
                    translateFile = `Personal/${objectPrefix}${asset.fileName}.translate.json`
                    await scopeMap.getTranslateFile(s3Client, { name: translateFile })
                }
                const normalized = assetWorkspace.normalize()
                const importMap = Object.values(normalized)
                    .filter(isNormalImport)
                    .reduce((previous, { mapping = {}, from }) => {
                        return {
                            ...previous,
                            ...(Object.entries(mapping)
                                .reduce((previous, [key, scopedId]) => ({
                                    ...previous,
                                    [key]: {
                                        scopedId,
                                        asset: from
                                    }
                                }), {})
                            )
                        }
                    }, {})
                const importTree = await scopeMap.importAssetIds(importMap || {})
                scopeMap.translateNormalForm(normalized)

                await Promise.all([
                    dbRegister({
                        fileName,
                        translateFile,
                        importTree,
                        scopeMap: scopeMap.serialize(),
                        namespaceMap: scopeMap.namespaceMap,
                        assets: normalized
                    }),
                    ...((asset as NormalAsset).instance
                        ? []
                        : [
                            putTranslateFile(s3Client, {
                                name: translateFile,
                                importTree,
                                scopeMap: scopeMap.serialize(),
                                assetKey: asset.key
                            })
                        ]
                    ),
                    s3Client.send(new CopyObjectCommand({
                        Bucket: bucket,
                        CopySource: `${bucket}/${key}`,
                        Key: fileName
                    }))
                ])
                if (isNormalAsset(asset) && (!asset.Story) && ['Canon', 'Personal'].includes(asset.zone || '')) {
                    await cacheAsset(asset.key)
                }
            }
            messageBus.send({
                type: 'UploadResponse',
                uploadId: objectNameItems.join('/'),
                messageType: 'Success'
            })
        }
        catch {
            messageBus.send({
                type: 'UploadResponse',
                uploadId: objectNameItems.join('/'),
                messageType: 'Error'
            })
        }
    }

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucket,
            Key: key
        }))  
    }
    catch {}
    return {}

}
