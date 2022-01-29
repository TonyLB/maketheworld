import { CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'

import { getAssets } from '../serialize/s3Assets.js'
import { putTranslateFile, getTranslateFile } from "../serialize/translateFile.js"
import { scopeMap } from "../serialize/scopeMap.js"
import { dbRegister } from '../serialize/dbRegister.js'
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { splitType } from '../utilities/types.js'
import { DeleteItemCommand, QueryCommand, PutItemCommand } from "@aws-sdk/client-dynamodb"

const { TABLE_PREFIX, S3_BUCKET } = process.env;
const assetsTable = `${TABLE_PREFIX}_assets`
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const getConnectionsByPlayerName = async (dbClient, PlayerName) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: ephemeraTable,
        KeyConditionExpression: 'EphemeraId = :eid',
        ExpressionAttributeValues: marshall({
            ":eid": `PLAYER#${PlayerName}`
        }),
    }))
    const returnVal = Items
        .map(unmarshall)
        .reduce((previous, { DataCategory }) => {
            const [ itemType, itemKey ] = splitType(DataCategory)
            if (itemType === 'CONNECTION') {
                return [...previous, itemKey]
            }
            return previous
        }, [])
    return returnVal
}

export const createUploadLink = ({ s3Client, dbClient }) => async ({ PlayerName, fileName, RequestId }) => {
    const putCommand = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: `upload/${PlayerName}/${fileName}`,
        ContentType: 'text/plain'
    })
    const [presignedOutput] = await Promise.all([
        getSignedUrl(s3Client, putCommand, { expiresIn: 60 }),
        dbClient.send(new PutItemCommand({
            TableName: assetsTable,
            Item: marshall({
                AssetId: `UPLOAD#${PlayerName}/${fileName}`,
                DataCategory: `PLAYER#${PlayerName}`,
                RequestId
            })
        }))
    ])
    return presignedOutput
}

//
// uploadResponse forwards a processing response from an Upload to the players that have
// subscribed to know when it finishes processing.
//
const uploadResponse = ({ dbClient, apiClient }) => async ({ uploadId, ...rest }) => {
    const { Items = [] } = await dbClient.send(new QueryCommand({
        TableName: assetsTable,
        KeyConditionExpression: "#aid = :assetId",
        ExpressionAttributeNames: {
            "#aid": "AssetId"
        },
        ExpressionAttributeValues: marshall({
            ':assetId': `UPLOAD#${uploadId}`
        }),
        ProjectionExpression: "DataCategory, RequestId"
    }))
    const playerNames = Items
        .map(unmarshall)
        .map(({ DataCategory, RequestId }) => ({ PlayerName: splitType(DataCategory)[1], RequestId }))
    await Promise.all(playerNames
        .map(async ({ PlayerName, RequestId }) => {
            const connections = await getConnectionsByPlayerName(dbClient, PlayerName)
            await Promise.all((connections || [])
                .map((ConnectionId) => (
                    apiClient.send(new PostToConnectionCommand({
                        ConnectionId,
                        Data: JSON.stringify({
                            ...rest,
                            RequestId
                        })
                    })).then(() => (
                        dbClient.send(new DeleteItemCommand({
                            TableName: assetsTable,
                            Key: marshall({
                                AssetId: `UPLOAD#${uploadId}`,
                                DataCategory: `PLAYER#${PlayerName}`
                            })
                        }))    
                    ))
                ))
            )
        }))
}

export const handleUpload = ({ s3Client, dbClient, apiClient }) => async ({ bucket, key }) => {
    const objectNameItems = key.split('/').slice(1)
    const objectPrefix = objectNameItems.length > 1
        ? `${objectNameItems.slice(0, -1).join('/')}/`
        : ''

    const assetRegistryItems = await getAssets(s3Client, key)
    if (assetRegistryItems.length) {
        try {
            const asset = assetRegistryItems.find(({ tag }) => (['Asset', 'Character'].includes(tag)))
            if (asset && asset.key) {
                const fileName = `drafts/${objectPrefix}${asset.fileName}.wml`
                const translateFile = `drafts/${objectPrefix}${asset.fileName}.translate.json`
                const currentScopeMap = await getTranslateFile(s3Client, { name: translateFile })
                const scopeMapContents = scopeMap(assetRegistryItems, (currentScopeMap.scopeMap || {}))
    
                await Promise.all([
                    dbRegister(dbClient, {
                        fileName,
                        translateFile,
                        scopeMap: scopeMapContents,
                        assets: assetRegistryItems
                    }),
                    putTranslateFile(s3Client, {
                        name: translateFile,
                        scopeMap: scopeMapContents,
                        assetKey: asset.key
                    }),
                    s3Client.send(new CopyObjectCommand({
                        Bucket: bucket,
                        CopySource: `${bucket}/${key}`,
                        Key: fileName
                    }))
                ])
            }
            await uploadResponse({ dbClient, apiClient })({
                uploadId: objectNameItems.join('/'),
                messageType: 'Success',
                operation: 'Upload'
            })
        }
        catch {
            await uploadResponse({ dbClient, apiClient })({
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
