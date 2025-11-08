// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"

import internalCache from "./internalCache"

import {
    AssetAPIMessage,
    isFetchAssetAPIMessage,
    isUploadAssetLinkAPIMessage,
    isAssetCheckinAPIMessage,
    isAssetCheckoutAPIMessage,
    isAssetWhoAmIAPIMessage,
    isFetchImportsAPIMessage,
    isMetaDataAPIMessage,
    isAssetPlayerSettingsAPIMessage,
    isAssetLLMGenerateAPIMessage,
    isAssetCollaborationStatusAPIMessage
} from '@tonylb/mtw-interfaces/ts/asset.js'

import messageBus from "./messageBus/index.js"
import { sfnClient, snsClient } from "./clients"
import { AssetKey, ConnectionKey } from "@tonylb/mtw-utilities/ts/types"
import ReadOnlyAssetWorkspace from "@tonylb/mtw-asset-workspace/ts/readOnly"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { PublishCommand } from "@aws-sdk/client-sns"
import { createBackupEntry } from "./backups"
import { isEphemeraAssetId } from "@tonylb/mtw-interfaces/ts/baseClasses"
import { extractReturnValue } from './returnValue'
import { WMLEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import { StreamingEventMessage } from "./messageBus/baseClasses"

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.assets DataSource
import './contentHeaders'  // mtw.assets.contentHeaders DataSource
import './characters'  // mtw.assets.characters DataSource
import './library'  // mtw.assets.library DataSource
import './players'  // mtw.assets.players DataSource

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
                        const assetWorkspace = await ReadOnlyAssetWorkspace.fromUUID(assetKey)
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
        // Special handling for Initialize Subscription events from mtw.subscriptions
        if (event.source === 'mtw.subscriptions' && event["detail-type"].startsWith('Initialize Subscription -')) {
            // Extract dataSourceKey from the detail-type (format: "Initialize Subscription - mtw.assets.contentHeaders")
            const dataSourceKey = event["detail-type"].replace('Initialize Subscription - ', '')
            
            // Publish Initialize Subscription event directly to messageBus (no deserialization needed)
            messageBus.send({
                type: 'StreamingEvent',
                dataSourceKey: 'mtw.subscriptions',
                streamKey: event.detail.streamKey || '',
                event: {
                    type: event["detail-type"],
                    update: event.detail
                },
                timestamp: event.time ? new Date(event.time).getTime() : Date.now()
            })
        } else {
            // Find the appropriate deserializer for this data source
            const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
            
            if (deserializer) {
                // Convert EventBridge event to CoreExternalFormat using format transformer
                const coreFormat = fromEventBridgeFormat(event)
                
                // Deserialize the external event to internal format using the serializer
                const internalEvent = deserializer.deserialize({
                    dataSourceKey: coreFormat.dataSourceKey,
                    streamKey: coreFormat.streamKey,
                    externalUpdate: coreFormat.update as any
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
        // Flush messageBus and return after handling EventBridge events
        await messageBus.flush()
        return
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
                }
            })
        )
        await messageBus.flush()
        return
    }
    
    if (!request || !['fetch', 'metaData', 'fetchImportDefaults', 'fetchImports', 'upload', 'uploadImage', 'checkin', 'checkout', 'whoAmI', 'updatePlayerSettings', 'llmGenerate', 'collaborationStatus'].includes(request.message)) {
        context.fail(JSON.stringify(`Error: Unknown format ${JSON.stringify(event, null, 4) }`))
    }
    else {
        if (request.RequestId) {
            internalCache.Connection.set({ key: 'RequestId', value: request.RequestId })
        }
        if (isMetaDataAPIMessage(request)) {
            const metaItems = await internalCache.AssetMetaData.get(request.assetIds)
            if (connectionId) {
                await Promise.all(metaItems.map(({ AssetId, zone }) => (
                    snsClient.send(new PublishCommand({
                        TopicArn: FEEDBACK_TOPIC,
                        Message: JSON.stringify({
                            messageType: 'MetaData',
                            AssetId,
                            zone: zone || 'None'
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
                return metaItems.map(({ AssetId, zone }) => (
                    {
                        AssetId,
                        zone: zone || 'None'
                    }
                ))
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
