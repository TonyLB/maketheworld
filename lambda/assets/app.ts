// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"
import type { Readable } from "stream"

import { healAsset } from "./selfHealing/"
import { healPlayer } from "./selfHealing/player"

import internalCache from "./internalCache"

import {
    AssetAPIMessage,
    isFetchLibraryAPIMessage,
    isFetchAssetAPIMessage,
    isUploadAssetLinkAPIMessage,
    isAssetCheckinAPIMessage,
    isAssetCheckoutAPIMessage,
    isAssetSubscribeAPIMessage,
    isAssetWhoAmIAPIMessage,
    isParseWMLAPIMessage,
    isFetchImportsAPIMessage,
    isAssetUnsubscribeAPIMessage,
    isMetaDataAPIMessage,
    isAssetPlayerSettingsAPIMessage
} from '@tonylb/mtw-interfaces/dist/asset.js'

import messageBus from "./messageBus/index.js"
import { extractReturnValue } from './returnValue'
import { apiClient } from "./clients"

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

const streamToBuffer = async (stream: Readable): Promise<Buffer> => {
    const chunks: Buffer[] = []
    for await (let chunk of stream) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
}

export const handler = async (event, context) => {

    const { connectionId } = event.requestContext || {}
    internalCache.clear()
    internalCache.Connection.set({ key: 'connectionId', value: connectionId })
    internalCache.Connection.set({ key: 's3Client', value: s3Client })
    messageBus.clear()

    // Handle EventBridge messages
    if (event?.source === 'mtw.diagnostics') {
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
    if (event?.source === 'mtw.coordination') {
        if (event["detail-type"] === 'Format Image') {
            const { fileName, width, height, AssetId, imageKey } = event.detail
            if (fileName && AssetId && imageKey && width && height) {
                messageBus.send({
                    type: 'FormatImage',
                    fileName,
                    AssetId,
                    imageKey,
                    width,
                    height
                })
                await messageBus.flush()
                return await extractReturnValue(messageBus)
            }
            else {
                return JSON.stringify(`Invalid arguments specified for Format Image event`)
            }
        }
        if (event["detail-type"] === 'Remove Asset') {
            const { AssetId } = event.detail
            if (AssetId) {
                messageBus.send({
                    type: 'RemoveAsset',
                    AssetId
                })
                await messageBus.flush()
                return await extractReturnValue(messageBus)
            }
            else {
                return JSON.stringify(`Invalid arguments specified for Remove Asset event`)
            }
        }
    }
    
    const request = (event.body && JSON.parse(event.body) || undefined) as AssetAPIMessage | undefined
    if (!request || !['fetch', 'fetchLibrary', 'metaData', 'fetchImportDefaults', 'fetchImports', 'upload', 'uploadImage', 'checkin', 'checkout', 'unsubscribe', 'subscribe', 'whoAmI', 'parseWML', 'updatePlayerSettings'].includes(request.message)) {
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
        if (isMetaDataAPIMessage(request)) {
            const { address } = await internalCache.Meta.get(request.assetId)
            await apiClient.send({
                ConnectionId: connectionId,
                Data: JSON.stringify({
                    RequestId: request.RequestId,
                    messageType: 'MetaData',
                    AssetId: request.assetId,
                    zone: address ? address.zone : 'None'
                })
            })
        }
        if (isFetchImportsAPIMessage(request)) {
            messageBus.send({
                type: 'FetchImports',
                importsFromAsset: [{
                    assetId: request.assetId,
                    keys: request.keys
                }]
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
            messageBus.send({
                type: 'UploadURL',
                assetType: request.tag,
                images: request.images
            })
        }
        if (isParseWMLAPIMessage(request)) {
            messageBus.send({
                type: 'ParseWML',
                AssetId: request.AssetId,
                uploadName: request.uploadName,
                images: request.images
            })
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
        if (isAssetUnsubscribeAPIMessage(request)) {
            messageBus.send({
                type: 'LibraryUnsubscribe'
            })
        }
        if (isAssetWhoAmIAPIMessage(request)) {
            const player = await internalCache.Connection.get('player')
            if (player) {
                messageBus.send({
                    type: 'PlayerInfo',
                    player,
                    RequestId: request.RequestId
                })
            }
        }
        if (isAssetPlayerSettingsAPIMessage(request)) {
            const player = await internalCache.Connection.get('player')
            if (player) {
                messageBus.send({
                    type: 'PlayerSettings',
                    player,
                    RequestId: request.RequestId,
                    action: request.action,
                    values: request.values
                })
            }
        }
    }
    await messageBus.flush()
    return await extractReturnValue(messageBus)

}
