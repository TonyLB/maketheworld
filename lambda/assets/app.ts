// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"

import { healAsset } from "./selfHealing/"
import { healPlayer } from "./selfHealing/player"
// import { healPlayers } from "@tonylb/mtw-utilities/dist/selfHealing/index"

import internalCache from "./internalCache"

import {
    AssetAPIMessage,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadAssetLinkAPIMessage,
    isUploadImageLinkAPIMessage,
    isAssetCheckinAPIMessage,
    isAssetCheckoutAPIMessage,
    isAssetSubscribeAPIMessage,
    isParseWMLAPIMessage
} from '@tonylb/mtw-interfaces/dist/asset.js'

import messageBus from "./messageBus/index.js"
import { extractReturnValue } from './returnValue'

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

export const handler = async (event, context) => {

    const { connectionId } = event.requestContext || {}
    internalCache.clear()
    internalCache.Connection.set({ key: 'connectionId', value: connectionId })
    internalCache.Connection.set({ key: 's3Client', value: s3Client })
    messageBus.clear()

    // Handle EventBridge messages
    if (['mtw.diagnostics'].includes(event?.source || '')) {
        if (event["detail-type"] === 'Heal Asset') {
            if (event.detail?.fileName) {
                const returnVal = await healAsset(event.detail.fileName)
                return JSON.stringify(returnVal, null, 4)
            }
            return JSON.stringify(`No fileName specified for Heal Asset event`)
        }
        if (event["detail-type"] === 'Heal Player') {
            if (event.detail?.player) {
                const returnVal = await healPlayer(event.detail.player)
                return JSON.stringify(returnVal, null, 4)
            }
            return JSON.stringify(`No player specified for Heal Player event`)
        }
    }
    
    // if (event.heal) {
    //     const returnVal = await healPlayers()
    //     return JSON.stringify(returnVal, null, 4)
    // }
    const request = (event.body && JSON.parse(event.body) || undefined) as AssetAPIMessage | undefined
    if (!request || !['fetch', 'fetchLibrary', 'upload', 'uploadImage', 'checkin', 'checkout', 'subscribe', 'parseWML'].includes(request.message)) {
        context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))
    }
    else {
        if (request.RequestId) {
            internalCache.Connection.set({ key: 'RequestId', value: request.RequestId })
        }
        if (isFetchLibraryAPIMessage(request)) {
            messageBus.send({
                type: 'FetchLibrary'
            })
        }
        if (isFetchAssetAPIMessage(request)) {
            messageBus.send({
                type: 'FetchAsset',
                fileName: request.fileName,
                AssetId: request.AssetId
            })
        }
        if (isUploadAssetLinkAPIMessage(request)) {
            messageBus.send({ type: 'UploadURL' })
        }
        if (isUploadImageLinkAPIMessage(request)) {
            messageBus.send({
                type: 'UploadImageURL',
                fileExtension: request.fileExtension,
                tag: request.tag,
                uploadRequestId: request.uploadRequestId
            })
        }
        if (isParseWMLAPIMessage(request)) {
            if (request.zone === 'Personal') {
                const player = await internalCache.Connection.get('player')
                if (player) {
                    messageBus.send({
                        type: 'ParseWML',
                        fileName: request.fileName,
                        zone: request.zone,
                        player: player,
                        subFolder: request.subFolder,
                        uploadName: request.uploadName
                    })
                }
            }
            else {
                messageBus.send({
                    type: 'ParseWML',
                    fileName: request.fileName,
                    zone: request.zone,
                    subFolder: request.subFolder,
                    uploadName: request.uploadName
                })    
            }
        }
        if (isAssetCheckinAPIMessage(request)) {
            messageBus.send({
                type: 'MoveByAssetId',
                AssetId: request.AssetId,
                toZone: 'Library'
            })
        }
        if (isAssetCheckoutAPIMessage(request)) {
            const player = await internalCache.Connection.get('player')
            if (player) {
                messageBus.send({
                    type: 'MoveByAssetId',
                    AssetId: request.AssetId,
                    toZone: `Personal`,
                    player
                })
            }
        }
        if (isAssetSubscribeAPIMessage(request)) {
            messageBus.send({
                type: 'LibrarySubscribe'
            })
        }
    }
    await messageBus.flush()
    return await extractReturnValue(messageBus)

}
