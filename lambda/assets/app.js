// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi'

import { cacheAsset } from './cache.js'
import { healAsset, healPlayers } from "./selfHealing/index.js"
import { getAssets } from "./serialize/s3Assets.js"
import { putTranslateFile, getTranslateFile } from "./serialize/translateFile.js"
import { scopeMap } from "./serialize/scopeMap.js"
import { dbRegister } from './serialize/dbRegister.js'
import { splitType } from './utilities/types.js'

import { handleUpload, createUploadLink } from './upload/index.js'
import { createFetchLink } from './fetch/index.js'
import { moveAsset } from './moveAsset/index.js'

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
// TODO: Step 3
//
// Update the CharacterEdit component to accept routes other than New
// and look up the character defaults to populate the form
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
        const remap = ['Name', 'Pronouns', 'FirstImpression', 'Outfit', 'OneCoolThing', 'fileName']
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
            //
            // TODO: Add a parallel operation to update the Characters field on the relevant player
            // for the incoming character
            //
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

export const handler = async (event, context) => {

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

    const { message = '' } = event
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
    switch(message) {
        case 'upload':
            return await createUploadLink({ s3Client, dbClient, apiClient})({
                PlayerName: event.PlayerName,
                fileName: event.fileName,
                RequestId: event.RequestId
            })
        case 'fetch':
            return await createFetchLink({ s3Client })({
                PlayerName: event.PlayerName,
                fileName: event.fileName
            })
        case 'move':
            return await moveAsset({ s3Client, dbClient })({
                fromPath: event.fromPath,
                fileName: event.fileName,
                toPath: event.toPath
            })
    }
    context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))

}
