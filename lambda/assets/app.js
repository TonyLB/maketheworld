// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"

import { cacheAsset } from './cache/index.js'
import { instantiateAsset } from './cache/instantiate/index.js'
import { healAsset } from "./selfHealing/index.js"
import { healPlayers } from "@tonylb/mtw-utilities/dist/selfHealing/index"

import { handleUpload, createUploadLink, createUploadImageLink } from './upload/index.js'
import { createFetchLink } from './fetch/index.js'
import { moveAsset, canonize, libraryCheckin, libraryCheckout } from './moveAsset/index.js'
import { handleDynamoEvent } from './dynamoEvents/index.js'
import { fetchLibrary } from "./assetLibrary/fetch.js"
import internalCache from "./internalCache"

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

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
        return await handleUpload({ s3Client })({ bucket, key })
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
    const { connectionId } = event.requestContext
    internalCache.clear()
    internalCache.set({ category: 'Global', key: 'connectionId', value: connectionId })
    if (event.cache) {
        const fileName = await cacheAsset(event.cache)

        return JSON.stringify({ fileName })
    }
    if (event.instantiate) {
        const fileName = await instantiateAsset({
            assetId: event.instantiate,
            options: { instantiateRooms: true }
        })

        return JSON.stringify({ fileName })
    }
    if (event.healAsset) {
        const returnVal = await healAsset({ s3Client }, event.healAsset)
        return JSON.stringify(returnVal, null, 4)
    }
    if (event.heal) {
        const returnVal = await healPlayers()
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
        case 'uploadImage':
            return await createUploadImageLink({ s3Client })({
                PlayerName: event.PlayerName,
                fileExtension: event.fileExtension,
                tag: event.tag,
                RequestId: event.RequestId
            })
        case 'move':
            return await moveAsset({ s3Client })({
                fromPath: event.fromPath,
                fileName: event.fileName,
                toPath: event.toPath
            })
    }
    const request = event.body && JSON.parse(event.body) || {}
    if (request.RequestId) {
        internalCache.set({ category: 'Global', key: 'RequestId', value: request.RequestId })
    }
    const player = await internalCache.get({ category: 'Lookup', key: 'player' })
    switch(request.message) {
        case 'fetchLibrary':
            const libraryEphemera = await fetchLibrary(request.RequestId)
            return {
                statusCode: 200,
                body: JSON.stringify(libraryEphemera)
            }
        case 'fetch':
            if (player) {
                const presignedURL = await createFetchLink({ s3Client })({
                    PlayerName: player,
                    fileName: request.fileName,
                    AssetId: request.AssetId
                })
                return {
                    statusCode: 200,
                    body: JSON.stringify({ messageType: "FetchURL", RequestId: request.RequestId, url: presignedURL })
                }
            }
            break
        case 'upload':
            if (player) {
                const presignedURL = await createUploadLink({ s3Client })({
                    PlayerName: player,
                    fileName: request.fileName,
                    tag: request.tag,
                    RequestId: request.uploadRequestId
                })
                return {
                    statusCode: 200,
                    body: JSON.stringify({ messageType: "UploadURL", RequestId: request.RequestId, url: presignedURL })
                }
            }
            break
        case 'uploadImage':
            if (player) {
                const presignedURL = await createUploadImageLink({ s3Client })({
                    PlayerName: player,
                    fileExtension: request.fileExtension,
                    tag: request.tag,
                    RequestId: request.uploadRequestId
                })
                return {
                    statusCode: 200,
                    body: JSON.stringify({ messageType: "UploadURL", RequestId: request.RequestId, url: presignedURL })
                }
            }
            break
        default:
            context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))
    }

}
