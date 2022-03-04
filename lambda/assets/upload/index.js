import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { getAssets } from '../serialize/s3Assets.js'
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
import { importedAssetIds } from '../serialize/importedAssets.js'
import { scopeMap } from "../serialize/scopeMap.js"
import { dbRegister } from '../serialize/dbRegister.js'
import { splitType } from '/opt/utilities/types.js'
import { assetRegistryEntries } from "../wml/index.js"
import { cacheAsset } from "../cache/index.js"

import { ephemeraDB, assetDB } from "/opt/utilities/dynamoDB/index.js"
import { SocketQueue } from "/opt/utilities/apiManagement/index.js"

const { S3_BUCKET } = process.env;

const getConnectionsByPlayerName = async (PlayerName) => {
    const Items = await ephemeraDB.query({
        EphemeraId: `PLAYER#${PlayerName}`
    })
    
    const returnVal = Items
        .reduce((previous, { DataCategory }) => {
            const [ itemType, itemKey ] = splitType(DataCategory)
            if (itemType === 'CONNECTION') {
                return [...previous, itemKey]
            }
            return previous
        }, [])
    return returnVal
}

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

//
// uploadResponse forwards a processing response from an Upload to the players that have
// subscribed to know when it finishes processing.
//
const uploadResponse = async ({ uploadId, ...rest }) => {
    const Items = await assetDB.query({
        AssetId: `UPLOAD#${uploadId}`,
        ProjectionFields: ['DataCategory', 'RequestId']
    })
    const playerNames = Items
        .map(({ DataCategory, RequestId }) => ({ PlayerName: splitType(DataCategory)[1], RequestId }))
    await Promise.all(playerNames
        .map(async ({ PlayerName, RequestId }) => {
            const connections = await getConnectionsByPlayerName(PlayerName)
            await Promise.all((connections || [])
                .map(async (ConnectionId) => {
                    const socketQueue = new SocketQueue()
                    socketQueue.send({
                        ConnectionId, 
                        Message: {
                            ...rest,
                            RequestId
                        }
                    })
                    await socketQueue.flush()
                    await assetDB.deleteItem({
                        AssetId: `UPLOAD#${uploadId}`,
                        DataCategory: `PLAYER#${PlayerName}`
                    })
                })
            )
        }))
}

export const handleUpload = ({ s3Client }) => async ({ bucket, key }) => {
    const objectNameItems = key.split('/').slice(1)
    const objectPrefix = objectNameItems.length > 1
        ? `${objectNameItems.slice(0, -1).join('/')}/`
        : ''

    const assetWorkspace = await getAssets(s3Client, key)
    const assetRegistryItems = (assetWorkspace && assetRegistryEntries(assetWorkspace.schema())) || []

    if (assetRegistryItems.length) {
        try {
            const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
            if (asset && asset.key) {
                const fileName = `Personal/${objectPrefix}${asset.fileName}.wml`
                let translateFile
                let currentScopeMap = {}
                if (!asset.instance) {
                    translateFile = `Personal/${objectPrefix}${asset.fileName}.translate.json`
                    currentScopeMap = (await getTranslateFile(s3Client, { name: translateFile })).scopeMap || {}
                }
                const normalized = assetWorkspace.normalize()
                const importMap = Object.values(normalized)
                    .filter(({ tag }) => (tag === 'Import'))
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
                const { importTree, scopeMap: importedIds } = await importedAssetIds(importMap || {})
                const scopeMapContents = scopeMap(
                    assetRegistryItems,
                    {
                        ...currentScopeMap,
                        ...importedIds
                    }
                )

                await Promise.all([
                    dbRegister({
                        fileName,
                        translateFile,
                        importTree,
                        scopeMap: scopeMapContents,
                        assets: assetRegistryItems
                    }),
                    ...(asset.instance
                        ? []
                        : [
                            putTranslateFile(s3Client, {
                                name: translateFile,
                                importTree,
                                scopeMap: scopeMapContents,
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
                if (['Asset'].includes(asset.tag) && (!asset.Story) && ['Canon', 'Personal'].includes(asset.zone)) {
                    await cacheAsset(asset.key)
                }
            }
            await uploadResponse({
                uploadId: objectNameItems.join('/'),
                messageType: 'Success',
                operation: 'Upload'
            })
        }
        catch {
            await uploadResponse({
                uploadId: objectNameItems.join('/'),
                messageType: 'Error',
                operation: 'Upload'
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
