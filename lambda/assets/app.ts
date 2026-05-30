// Import required AWS SDK clients and commands for Node.js
import { S3Client } from "@aws-sdk/client-s3"

import internalCache from "./internalCache"

import {
    AssetAPIMessage,
    isFetchAssetAPIMessage,
    isUploadAssetLinkAPIMessage,
    isFetchImportsAPIMessage,
    isMetaDataAPIMessage,
    isAssetPlayerSettingsAPIMessage,
    isAssetLLMGenerateAPIMessage,
    isAssetCollaborationStatusAPIMessage
} from '@tonylb/mtw-interfaces/ts/asset.js'

import messageBus from "./messageBus/index.js"
import { sendPlayerSettingsUpdated } from './players/subscribedEvents'
import { sendInitializeSubscription } from './dataSource/initSubscription'
import { sfnClient, snsClient } from "./clients"
import { ConnectionKey } from "@tonylb/mtw-utilities/ts/types"
import { StartExecutionCommand } from "@aws-sdk/client-sfn"
import { PublishCommand } from "@aws-sdk/client-sns"
import { createBackupEntry } from "./backups"
import { extractReturnValue } from './returnValue'
import { sendApiAssetsEvent } from './dataSource/apiAssets'
import { WMLEventSerializer, WMLEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { DiagnosticsEventSerializer, DiagnosticsEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { CognitoEventSerializer, CognitoEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/cognito'
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform'
import { coreFormatToStreamingEnvelope, createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment'

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.assets DataSource
import './contentHeaders'  // mtw.assets.contentHeaders DataSource
import './characters'  // mtw.assets.characters DataSource
import './library'  // mtw.assets.library DataSource
import './players'  // mtw.assets.players DataSource
import './componentExamples'  // mtw.assets.componentExamples DataSource
import './componentTopology'  // mtw.assets.componentTopology DataSource
import './dataSource/components/verticals'  // mtw.assets.components.verticals DataSource

const { FEEDBACK_TOPIC } = process.env
const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.wml': new WMLEventSerializer(createNodeDataSourceEnvironment()),
    'mtw.diagnostics': new DiagnosticsEventSerializer(createNodeDataSourceEnvironment()),
    'mtw.cognito': new CognitoEventSerializer(createNodeDataSourceEnvironment()),
} as const

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
            case 'HealPlayer':
                if (typeof event.player === 'string' && event.player.length > 0) {
                    sendApiAssetsEvent(messageBus, {
                        type: 'HealPlayer',
                        player: event.player
                    })
                    await messageBus.flush()
                }
                return await extractReturnValue(messageBus)
            case 'HealComponentVertical':
                if (typeof event.assetId === 'string' && event.assetId.length > 0) {
                    sendApiAssetsEvent(messageBus, {
                        type: 'HealComponentVertical',
                        assetId: event.assetId,
                        ...(Array.isArray(event.componentUniversalKeys)
                            ? { componentUniversalKeys: event.componentUniversalKeys }
                            : {}),
                    })
                    await messageBus.flush()
                }
                return await extractReturnValue(messageBus)
            case 'cacheAsset': {
                // Legacy Step Function call - publish as internal format StreamEvent for data source processing
                const streamKey = `ASSET#${event.assetId}`
                const timestamp = Date.now()
                const content = {
                    type: 'Content Update',
                    update: {
                        AssetId: event.assetId
                    }
                }
                const header = {
                    dataSourceKey: 'mtw.wml',
                    streamKey,
                    timestamp,
                    type: 'Content Update'
                }
                const identitySerializer = { serialize: ({ content: c }: { content: typeof content }) => c }
                const envelope = createInternalOriginEnvelope(header, content, identitySerializer)
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: 'mtw.wml',
                    streamKey,
                    header: envelope.header,
                    getContent: envelope.getContent,
                    timestamp
                })
                await messageBus.flush()
                return {}
            }
            case 'createBackupEntry':
                return await createBackupEntry({ AssetId: event.AssetId })
        }
    }

    if (event?.type === 'HealPlayer' && typeof event.player === 'string' && event.player.length > 0) {
        sendApiAssetsEvent(messageBus, {
            type: 'HealPlayer',
            player: event.player
        })
        await messageBus.flush()
        return await extractReturnValue(messageBus)
    }

    if (event?.type === 'HealComponentVertical' && typeof event.assetId === 'string' && event.assetId.length > 0) {
        sendApiAssetsEvent(messageBus, {
            type: 'HealComponentVertical',
            assetId: event.assetId,
            ...(Array.isArray(event.componentUniversalKeys)
                ? { componentUniversalKeys: event.componentUniversalKeys }
                : {}),
        })
        await messageBus.flush()
        return await extractReturnValue(messageBus)
    }

    // Handle EventBridge messages by publishing to messageBus for DataSource processing
    if (event?.source && event["detail-type"]) {
        // Special handling for Initialize Subscription events from mtw.subscriptions
        if (event.source === 'mtw.subscriptions' && event["detail-type"].startsWith('Initialize Subscription -')) {
            // Publish Initialize Subscription event directly to messageBus (no deserialization needed).
            // The target DataSource is encoded in detail-type, e.g. "Initialize Subscription - mtw.assets.contentHeaders".
            const streamKey = event.detail.streamKey || ''
            const dataSourceKey = (event["detail-type"] as string).replace(/^Initialize Subscription - /, '')
            sendInitializeSubscription(messageBus, dataSourceKey, streamKey, event.detail.sessionId, event.detail.requestId)
        } else {
            // Find the appropriate deserializer for this data source
            const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
            
            if (deserializer) {
                // Convert EventBridge event to CoreExternalFormat using format transformer
                const coreFormat = fromEventBridgeFormat(event)
                const envelope = coreFormatToStreamingEnvelope<WMLEventUpdate | DiagnosticsEventUpdate | CognitoEventUpdate | null>(coreFormat, () =>
                    deserializer.deserialize({ content: coreFormat.update as any, header: coreFormat.header })
                )
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: envelope.header.dataSourceKey,
                    streamKey: envelope.header.streamKey,
                    header: envelope.header,
                    getContent: envelope.getContent,
                    timestamp: event.time ? new Date(event.time).getTime() : envelope.header.timestamp
                })
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

    if (!request || !['fetch', 'metaData', 'fetchImportDefaults', 'fetchImports', 'upload', 'uploadImage', 'checkin', 'checkout', 'updatePlayerSettings', 'llmGenerate', 'collaborationStatus'].includes(request.message)) {
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
        // Legacy whoAmI API endpoint removed - player data now flows through mtw.assets.players data source
        // Clients subscribe to the data source stream instead of calling this API
                if (isAssetPlayerSettingsAPIMessage(request)) {
            const player = await internalCache.Connection.get('player')
            if (player) {
                // NOTE: This is part of the legacy pattern where API calls enqueue custom messageBus
                // payloads (here: PlayerSettings). We will eventually migrate these to the unified
                // data-source streaming events (matching the applyEdit/moveAsset pattern in the WML
                // lambda) once the mtw.assets.players data source subsumes the old flow. For now, we
                // emit both the legacy message and a streaming event so the new player data source can
                // subscribe without breaking existing flows.
                const content = {
                    type: 'Player Settings Updated' as const,
                    actions: request.actions,
                    ...(request.RequestId ? { RequestId: request.RequestId } : {})
                }
                sendPlayerSettingsUpdated(messageBus, player, content)
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
