// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"
import AWSXRay from 'aws-xray-sdk'
import type { Readable } from "stream"

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
import { sfnClient, snsClient } from "./clients"
import { assetWorkspaceFromAssetId } from "./utilities/assets"
import { AssetKey } from "@tonylb/mtw-utilities/dist/types"
import { healGlobalValues } from "./selfHealing/globalValues"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { PublishCommand } from "@aws-sdk/client-sns"

const { FEEDBACK_TOPIC } = process.env
const params = { region: process.env.AWS_REGION }
const s3Client = AWSXRay.captureAWSv3Client(new S3Client(params))

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
        await sfnClient.send(new StartExecutionCommand({
            stateMachineArn: process.env.HEAL_SFN,
            input: JSON.stringify({
                type: 'Player',
                player: event.userName,
            })
        }))
        return event
    }

    // Handle EventBridge messages
    if (event?.source === 'mtw.diagnostics') {
        if (event["detail-type"] === 'Heal Global Values') {
            const returnVal = await healGlobalValues({
                shouldHealConnections: Boolean(event.detail?.connections),
                shouldHealGlobalAssets: typeof event.detail?.assets !== 'boolean' || event.detail?.assets
            })
            return JSON.stringify(returnVal, null, 4)
        }
    }
    if (event?.source === 'mtw.coordination') {
        if (event["detail-type"] === 'Remove Asset') {
            const { assetId } = event.detail
            if (assetId) {
                messageBus.send({
                    type: 'RemoveAsset',
                    assetId
                })
                await messageBus.flush()
                return {}
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
                return {}
            }
            else {
                return JSON.stringify(`Invalid arguments specified for ${event["detail-type"]} event`)
            }
        }
    }

    // Handle SNS messages
    if (Array.isArray(event?.Records)) {
        await Promise.all(event.Records
            .filter(({ Sns }) => (Sns))
            .map(async ({ Sns }) => {
                const message = JSON.parse(Sns.Message)
                if (Sns.MessageAttributes.Type?.Type !== 'String') {
                    throw new Error(`Incoming message format failure (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
                }
                switch(Sns.MessageAttributes.Type.Value) {
                    case 'PlayerInfo':
                        if (typeof message?.player !== 'string') {
                            throw new Error(`Incoming message format failure (${JSON.stringify(Sns.MessageAttributes, null, 4)})`)
                        }
                        messageBus.send({
                            type: 'PlayerInfo',
                            player: message.player
                        })
                        break
                    case 'LibraryUpdate':
                        messageBus.send({
                            type: 'LibraryUpdate'
                        })
                        break
                }
            })
        )
        await messageBus.flush()
        return
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
        if (isMetaDataAPIMessage(request)) {
            const addresses = await internalCache.Meta.get(request.assetIds)
            if (connectionId) {
                await Promise.all(addresses.map(({ AssetId, address }) => (
                    snsClient.send(new PublishCommand({
                        TopicArn: FEEDBACK_TOPIC,
                        Message: JSON.stringify({
                            messageType: 'MetaData',
                            AssetId,
                            zone: address ? address.zone : 'None'
                        }),
                        MessageAttributes: {
                            RequestId: { DataType: 'String', StringValue: request.RequestId },
                            ConnectionIds: { DataType: 'String.Array', StringValue: JSON.stringify([connectionId]) },
                            Type: { DataType: 'String', StringValue: 'Success' }
                        }
                    }))
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
            const player = await internalCache.Connection.get('player')
            await sfnClient.send(new StartExecutionCommand({
                stateMachineArn: process.env.CACHE_ASSETS_SFN,
                input: JSON.stringify({
                    player,
                    requestId: request.RequestId,
                    connectionId,
                    assetId: request.AssetId,
                    images: request.images,
                    uploadName: request.uploadName
                })
            }))
            return {
                statusCode: 200,
                body: JSON.stringify({ messageType: 'Progress', progress: 1, of: 2 })
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
    return {
        statusCode: 200,
        body: JSON.stringify({ messageType: 'Success' })
    }

}
