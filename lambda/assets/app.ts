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
} from '@tonylb/mtw-interfaces/ts/asset.js'

import messageBus from "./messageBus/index.js"
import { extractReturnValue } from './returnValue'
import { apiClient, ebClient } from "./clients"
import { assetWorkspaceFromAssetId } from "./utilities/assets"
import { PutEventsCommand } from "@aws-sdk/client-eventbridge"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import { newGuestName } from "./player/guestNames"
import { healGlobalValues } from "./selfHealing/globalValues"

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

    const request = (event.body && JSON.parse(event.body) || undefined) as AssetAPIMessage | undefined
    const { connectionId } = request?.connectionId || event.requestContext || {}
    internalCache.clear()
    internalCache.Connection.set({ key: 'connectionId', value: connectionId })
    internalCache.Connection.set({ key: 's3Client', value: s3Client })
    messageBus.clear()

    //
    // Handle direct calls (not by way of API, probably by way of Step Functions)
    //
    if (event?.message) {
        switch(event.message) {
            case 'metaData':
                return await Promise.all(
                    (event.assetIds || []).map(async (assetId) => {
                        const assetKey = AssetKey(assetId)
                        const assetWorkspace = await assetWorkspaceFromAssetId(assetKey)
                        return assetWorkspace?.address
                    })
                )
        }
    }

    // Handle Cognito PostConfirm messages
    if (event?.triggerSource === 'PostConfirmation_ConfirmSignUp' && event?.userName) {
        //
        // TODO: Check whether player record already exists, and if so then update
        // custom:guestName and return
        //

        //
        // TODO: If player does not yet exist, call healPlayer to create the
        // player and send an UpdatePlayer message to Ephemera lambda
        //
        internalCache.Connection.set({ key: 'player', value: event?.userName})
        await healPlayer(event?.userName)
        return event
    }

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
        if (event["detail-type"] === 'Heal Global Values') {
            const returnVal = await healGlobalValues({
                shouldHealConnections: Boolean(event.detail?.connections),
                shouldHealGlobalAssets: typeof event.detail?.assets !== 'boolean' || event.detail?.assets
            })
            return JSON.stringify(returnVal, null, 4)
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
            const { assetId } = event.detail
            if (assetId) {
                messageBus.send({
                    type: 'RemoveAsset',
                    assetId
                })
                await messageBus.flush()
                return await extractReturnValue(messageBus)
            }
            else {
                return JSON.stringify(`Invalid arguments specified for Remove Asset event`)
            }
        }
        if (['Canonize Asset', 'Decanonize Asset'].includes(event["detail-type"])) {
            const { assetId } = event.detail
            if (assetId) {
                messageBus.send({
                    type: 'MoveByAssetId',
                    AssetId: `ASSET#${assetId}`,
                    toZone: event["detail-type"] === 'Canonize Asset' ? 'Canon' : 'Library'
                })
                await messageBus.flush()
                return await extractReturnValue(messageBus)
            }
            else {
                return JSON.stringify(`Invalid arguments specified for ${event["detail-type"]} event`)
            }
        }
    }
    
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
        //
        // TODO: Refactor cacheAssets step function to directly make address lookups, rather than depending on
        // asset lambda calls (to reduce circular dependencies)
        //
        if (isMetaDataAPIMessage(request)) {
            const addresses = await internalCache.Meta.get(request.assetIds)
            if (connectionId) {
                await Promise.all(addresses.map(({ AssetId, address }) => (
                    apiClient.send({
                        ConnectionId: connectionId,
                        Data: JSON.stringify({
                            RequestId: request.RequestId,
                            messageType: 'MetaData',
                            AssetId,
                            zone: address ? address.zone : 'None'
                        })
                    })
                )))
            }
            else {
                return addresses
            }
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
                images: request.images,
                create: request.create
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
                    actions: request.actions
                })
            }
        }
    }
    await messageBus.flush()
    return await extractReturnValue(messageBus)

}
