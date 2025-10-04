// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"

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
    isFetchImportsAPIMessage,
    isAssetUnsubscribeAPIMessage,
    isMetaDataAPIMessage,
    isAssetPlayerSettingsAPIMessage,
    isAssetLLMGenerateAPIMessage,
    isAssetCollaborationStatusAPIMessage
} from '@tonylb/mtw-interfaces/ts/asset.js'

import messageBus from "./messageBus/index.js"
import { sfnClient, snsClient } from "./clients"
import { assetWorkspaceFromAssetId } from "./utilities/assets"
import { AssetKey, ConnectionKey } from "@tonylb/mtw-utilities/ts/types"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { PublishCommand } from "@aws-sdk/client-sns"
import { createBackupEntry } from "./backups"
import { isEphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { extractReturnValue } from './returnValue'
import { WMLEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

const { FEEDBACK_TOPIC } = process.env
const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.wml': new WMLEventSerializer(),
    // Add other data source deserializers here as needed
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
            case 'cacheAsset':
                // Legacy Step Function call - publish as internal format StreamEvent for data source processing
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.wml',
                    streamKey: `ASSET#${event.assetId}`,
                    event: {
                        type: 'Content Update',
                        update: {
                            AssetId: event.assetId
                        }
                    },
                    timestamp: Date.now()
                })
                await messageBus.flush()
                return {}
            case 'decacheAsset':
                // Legacy Step Function call - publish as internal format WML Content Removed event
                // This represents an asset being removed, which should trigger decaching
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.wml',
                    streamKey: `ASSET#${event.assetId}`,
                    event: {
                        type: 'Content Removed',
                        update: {
                            AssetId: event.assetId
                        }
                    },
                    timestamp: Date.now()
                })
                await messageBus.flush()
                return{}
            case 'metaData':
                return await Promise.all(
                    (event.assetIds || []).map(async (assetId) => {
                        const assetKey = AssetKey(assetId)
                        const assetWorkspace = await assetWorkspaceFromAssetId(assetKey)
                        return assetWorkspace?.address
                    })
                )
            case 'createBackupEntry':
                return await createBackupEntry({ AssetId: event.AssetId })
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

    // Handle EventBridge messages by publishing to messageBus for DataSource processing
    if (event?.source && event["detail-type"]) {
        // Find the appropriate deserializer for this data source
        const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
        
        if (deserializer) {
            // Deserialize the external EventBridge event to internal format
            const internalEvent = deserializer.deserialize({
                dataSourceKey: event.source,
                streamKey: event.detail.streamKey || '', // Extract streamKey from detail
                externalUpdate: event.detail
            })
            
            // If deserialization failed, log error and skip this event
            if (!internalEvent) {
                messageBus.send({
                    type: 'Error',
                    body: {
                        error: `Failed to deserialize event from ${event.source}: ${event["detail-type"]}`
                    }
                })
            } else {
                // Publish deserialized event to messageBus for DataSource processing
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: event.source,
                    streamKey: event.detail.streamKey || '',
                    event: {
                        type: internalEvent.type,
                        update: internalEvent
                    },
                    timestamp: event.time ? new Date(event.time).getTime() : Date.now()
                })
            }
        } else {
            // No deserializer available - this is an error condition
            messageBus.send({
                type: 'Error',
                body: {
                    error: `No deserializer available for data source: ${event.source}`
                }
            })
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
    
    if (!request || !['fetch', 'fetchLibrary', 'metaData', 'fetchImportDefaults', 'fetchImports', 'upload', 'uploadImage', 'checkin', 'checkout', 'unsubscribe', 'subscribe', 'whoAmI', 'updatePlayerSettings', 'llmGenerate', 'collaborationStatus'].includes(request.message)) {
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
            const addresses = await internalCache.AssetMetaData.get(request.assetIds)
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
                            Targets: { DataType: 'String.Array', StringValue: JSON.stringify([ConnectionKey(connectionId)]) },
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
            const sessionId = await internalCache.Connection.get('sessionId')
            if (player) {
                messageBus.send({
                    type: 'PlayerInfo',
                    player,
                    sessionId,
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
        if (isAssetLLMGenerateAPIMessage(request)) {
            await sfnClient.send(new StartExecutionCommand({
                stateMachineArn: process.env.LLM_GENERATE_SFN,
                input: JSON.stringify({
                    requestId: request.RequestId,
                    connectionId,
                    name: request.name
                })
            }))
            return {
                statusCode: 200,
                body: JSON.stringify({ messageType: 'Progress', progress: 1, of: 2 })
            }
        }
        if (isAssetCollaborationStatusAPIMessage(request)) {
            messageBus.send({
                type: 'CollaborationStatus',
                RequestId: request.RequestId
            })
        }
    }
    await messageBus.flush()
    return await extractReturnValue(messageBus)

}
