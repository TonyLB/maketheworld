// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider"
import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi'

import { cacheAsset } from './cache.js'
import { healAsset, healPlayers } from "./selfHealing/index.js"

import { handleUpload, createUploadLink } from './upload/index.js'
import { createFetchLink } from './fetch/index.js'
import { moveAsset, canonize, libraryCheckin, libraryCheckout } from './moveAsset/index.js'
import { handleDynamoEvent } from './dynamoEvents/index.js'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)
const cognitoClient = new CognitoIdentityProviderClient(params)

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
        return await handleUpload({ s3Client, apiClient })({ bucket, key })
    }
    else {
        const errorMsg = JSON.stringify(`Error: Unknown S3 target: ${JSON.stringify(event, null, 4) }`)
        console.log(errorMsg)
        //
        // TODO: Better error handling
        //
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
            handleDynamoEvent({
                events: event.Records
                    .filter(({ dynamodb }) => (dynamodb))
            })
        ])
        return JSON.stringify(`Events Processed`)
    }

    //
    // In-Lambda testing outlet (to be removed once development complete)
    //

    const { message = '' } = event
    if (event.cache) {
        const fileName = await cacheAsset(event.cache)

        return JSON.stringify({ fileName })
    }
    if (event.healAsset) {
        const returnVal = await healAsset({ s3Client }, event.healAsset)
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.heal) {
        const returnVal = await healPlayers({ cognitoClient })
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.canonize) {
        const returnVal = await canonize({ s3Client })(event.canonize)
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.checkin) {
        const returnVal = await libraryCheckin({ s3Client })(event.checkin)
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.checkout) {
        const returnVal = await libraryCheckout(event.PlayerName)({ s3Client })(event.checkout)
        return JSON.stringify(returnVal, null, 4)
    }
    switch(message) {
        case 'upload':
            return await createUploadLink({ s3Client, apiClient})({
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
            return await moveAsset({ s3Client })({
                fromPath: event.fromPath,
                fileName: event.fileName,
                toPath: event.toPath
            })
    }
    context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))

}
