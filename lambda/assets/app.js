// Import required AWS SDK clients and commands for Node.js
const { S3Client, CopyObjectCommand, DeleteObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3")
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner")
const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb")
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb")
const { CognitoIdentityProviderClient } = require("@aws-sdk/client-cognito-identity-provider")
const { ApiGatewayManagementApiClient } = require('@aws-sdk/client-apigatewaymanagementapi')

const { cacheAsset } = require('./cache.js')
const { healAsset, healPlayers } = require("./selfHealing")
const { getAssets } = require("./serialize/s3Assets")
const { putTranslateFile, getTranslateFile } = require("./serialize/translateFile")
const { scopeMap } = require("./serialize/scopeMap")
const { dbRegister } = require('./serialize/dbRegister')
const { splitType } = require('./utilities/types')

const { handleUpload, createUploadLink } = require('./upload')

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)
const dbClient = new DynamoDBClient(params)
const cognitoClient = new CognitoIdentityProviderClient(params)

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

//
// TODO: Step 9
//
// Use the presigned URLs to upload updated characters to the asset library
//

const handleS3Event = async (event) => {
    const bucket = event.bucket.name;
    const key = decodeURIComponent(event.object.key.replace(/\+/g, ' '));

    const keyPrefix = key.split('/').slice(0, 1).join('/')
    if (keyPrefix === 'upload') {
        return await handleUpload({ s3Client, dbClient, apiClient })({ bucket, key })
    }
    else {
        const errorMsg = JSON.stringify(`Error: Unknown S3 target: ${JSON.stringify(event, null, 4) }`)
        console.log(errorMsg)
        //
        // TODO: Better error handling
        //
    }
}

const handleDynamoEvent = async (event) => {
    const { eventName, dynamodb } = event
    const oldImage = unmarshall(dynamodb.OldImage || {})
    const newImage = unmarshall(dynamodb.NewImage || {})
    if (newImage.DataCategory === 'Meta::Character') {
        const mappedValue = (key) => {
            if (newImage[key]) {
                if (!oldImage || (newImage[key] !== oldImage[key])) {
                    return { value: newImage[key] }
                }
            }
            else {
                if (oldImage[key]) {
                    return 'remove'
                }
            }
            return 'ignore'
        }
        const remap = ['Name', 'Pronouns', 'FirstImpression', 'Outfit', 'OneCoolThing']
            .reduce((previous, key) => ({ ...previous, [key]: mappedValue(key) }), {})
        const flagName = (key) => (key === 'Name' ? '#Name' : key)
        const setItems = Object.entries(remap)
            .filter(([key, value]) => (value instanceof Object))
            .map(([key]) => (`${flagName(key)} = :${key}`))
        const expressionValues = Object.entries(remap)
            .filter(([key, value]) => (value instanceof Object))
            .reduce((previous, [key, value]) => ({
                ...previous,
                [`:${key}`]: value.value
            }), {})
        const removeItems = Object.entries(remap)
            .filter(([key, value]) => (value === 'remove'))
            .map(([key]) => (flagName(key)))
        const UpdateExpression = [
            ...(setItems.length ? [`SET ${setItems.join(', ')}`] : []),
            ...(removeItems.length ? [`REMOVE ${removeItems.join(', ')}`] : [])
        ].join(' ')
        if (UpdateExpression) {
            const CharacterId = splitType(newImage.AssetId)[1]
            try {
                await dbClient.send(new UpdateItemCommand({
                    TableName: ephemeraTable,
                    Key: marshall({
                        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                        DataCategory: 'Connection'
                    }),
                    UpdateExpression,
                    ...(expressionValues ? { ExpressionAttributeValues: marshall(expressionValues) }: {}),
                    ...(remap['Name'] !== 'ignore' ? { ExpressionAttributeNames: { '#Name': 'Name' }} : {})
                }))
            }
            catch (error) {
                //
                // TODO: Error handling for common Dynamo errors
                //
                throw error
            }
        }
    }
}

exports.handler = async (event, context) => {

    // Handle S3 Events
    if (event.Records) {
        await Promise.all([
            ...event.Records
                .filter(({ s3 }) => (s3))
                .map(({ s3 }) => (s3))
                .map(handleS3Event),
            ...event.Records
                .filter(({ dynamodb }) => (dynamodb))
                .map(handleDynamoEvent)
        ])
        return JSON.stringify(`Events Processed`)
    }

    //
    // In-Lambda testing outlet (to be removed once development complete)
    //

    if (event.Evaluate) {
        const assetId = event.assetId
        const fileName = await cacheAsset(assetId)

        return JSON.stringify({ fileName })
    }
    if (event.healAsset) {
        const returnVal = await healAsset({ s3Client, dbClient }, event.healAsset)
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.heal) {
        // const returnVal = await healAsset({ s3Client, dbClient }, event.heal)
        const returnVal = await healPlayers({ cognitoClient, dbClient })
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.upload) {
        const { PlayerName, fileName } = event
        return await createUploadLink({ s3Client, dbClient, apiClient})({ PlayerName, fileName, RequestId: event.RequestId })
    }
    context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))

}
