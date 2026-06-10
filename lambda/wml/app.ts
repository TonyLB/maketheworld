import backupWML from "./backupWML";
import internalCache from "./internalCache";
import { S3Client } from "@aws-sdk/client-s3";
import messageBus from "./messageBus";
import { extractReturnValue } from "./returnValue/index";
import { sendApplyEdit, sendMoveAsset, sendPurgeAsset } from './dataSource/subscribedEvents';
import { runPromoteToCanon } from './promoteToCanon';
import { coordinateCanonizeAsset, coordinateMoveAsset, wmlDataSource } from './dataSource/mtw-wml';
import { AssetWorkspace } from './s3Storage/AssetWorkspace';
import type { Zone } from '@tonylb/mtw-interfaces/ts/baseClasses';
import { sendInitializeSubscription } from './dataSource/initSubscription';
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform';
import { coreFormatToStreamingEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource';
import { DiagnosticsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics';
import { createNodeDataSourceEnvironment } from '@tonylb/mtw-lambda-patterns/ts/dataSource/nodeEnvironment';
import { isWMLAPIMessage, WMLAPIMessage } from '@tonylb/mtw-interfaces/ts/wml';

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.wml DataSource

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.diagnostics': new DiagnosticsEventSerializer(createNodeDataSourceEnvironment()),
    // Add other data source deserializers here as needed
}

const promoteToCanonStreamEvent = (params: Parameters<typeof wmlDataSource.streamEvent>[0]) =>
    wmlDataSource.streamEvent(params)

export const handler = async (event: any, context: any) => {

    // Parse WebSocket API Gateway events
    const parsedRequest = event.body ? JSON.parse(event.body) : undefined
    const connectionId = event?.requestContext?.connectionId ?? parsedRequest?.connectionId

    internalCache.clear()
    if (connectionId) {
        internalCache.Connection.set({ key: 'connectionId', value: connectionId })
    }
    internalCache.Connection.set({ key: 's3Client', value: s3Client })
    messageBus.clear()

    // Handle EventBridge messages by publishing to messageBus for DataSource processing
    if (event?.source && event["detail-type"]) {
        // Initialize Subscription - mtw.wml: forward to messageBus so wmlDataSource can call initializeSubscription
        if (event.source === 'mtw.subscriptions' && event["detail-type"] === 'Initialize Subscription - mtw.wml') {
            const streamKey = event.detail.streamKey || ''
            sendInitializeSubscription(messageBus, 'mtw.wml', streamKey, event.detail.sessionId, event.detail.requestId)
            await messageBus.flushAndSettle()
            return
        }

        // Find the appropriate deserializer for this data source
        const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
        
        if (deserializer) {
            // Convert EventBridge event to CoreExternalFormat using format transformer
            const coreFormat = fromEventBridgeFormat(event)
            const envelope = coreFormatToStreamingEnvelope(coreFormat, () =>
                deserializer.deserialize({ content: coreFormat.update as any, header: coreFormat.header })
            )
            messageBus.publish({
                type: 'StreamingEvent',
                dataSourceKey: envelope.header.dataSourceKey,
                streamKey: envelope.header.streamKey,
                header: envelope.header,
                getContent: envelope.getContent,
                timestamp: event.time ? new Date(event.time).getTime() : envelope.header.timestamp
            })
        } else {
            // No deserializer available - this is an error condition
            messageBus.publish({
                type: 'Error',
                body: {
                    error: `No deserializer available for data source: ${event.source}`
                }
            })
        }
        // Flush messageBus and return after handling EventBridge events
        await messageBus.flushAndSettle()
        return
    }

    // Type-guard: Validate incoming message is a recognized WML API message
    if (!isWMLAPIMessage(parsedRequest)) {
        context.fail(JSON.stringify(`Error: Unknown WML message format ${JSON.stringify(event, null, 4)}`))
        return
    }
    
    // After type guard, TypeScript knows parsedRequest is WMLAPIMessage
    const request = parsedRequest

    // Handle WebSocket API Gateway calls (similar to assets lambda pattern)
    switch(request.message) {
        case 'backupWML':
            return await backupWML(request)
        
        // =============================================================================
        // WML EDIT HANDLING - USING SINGLEFLIGHT PATTERN
        // =============================================================================
        // This handler routes to the mtw-wml data source which uses singleFlight
        // sequential mode for proper concurrency control.
        //
        // The actual coordination now happens in:
        // - lambda/wml/dataSource/mtw-wml.ts (singleFlight wrapper)
        // - packages/mtw-lambda-patterns/ts/singleFlight/ (coordination logic)
        // =============================================================================
        case 'applyEdit': {
            // Handle WebSocket API calls and direct Lambda calls
            // Cache RequestId for connection-based tracking
            if (request.RequestId) {
                internalCache.Connection.set({ key: 'RequestId', value: request.RequestId })
            }
            const content = {
                type: 'Apply Edit' as const,
                RequestId: request.RequestId ?? '',
                schema: request.schema,
                createIfNeeded: request.createIfNeeded,
                zone: request.zone
            }
            sendApplyEdit(messageBus, request.AssetId, content)
            await messageBus.flushAndSettle()
            return await extractReturnValue(messageBus)
        }
        case 'moveAsset': {
            const content = {
                type: 'Move Asset' as const,
                fromZone: request.fromZone,
                toZone: request.toZone,
                player: request.player,
                subFolder: request.subFolder
            }
            sendMoveAsset(messageBus, request.AssetId, content)
            await messageBus.flushAndSettle()
            return await extractReturnValue(messageBus)
        }
        case 'purgeAsset': {
            const content = {
                type: 'Purge Asset' as const,
                expectedZone: request.expectedZone,
                requireExists: request.requireExists
            }
            sendPurgeAsset(messageBus, request.AssetId, content)
            await messageBus.flushAndSettle()
            return await extractReturnValue(messageBus)
        }
        case 'promoteToCanon': {
            if (request.RequestId) {
                internalCache.Connection.set({ key: 'RequestId', value: request.RequestId })
            }
            const existing = await AssetWorkspace.fromUUID(request.AssetId, { preferDynamo: false, allowS3Fallback: true })
            if (!existing) {
                return {
                    statusCode: 404,
                    body: JSON.stringify({
                        error: `Asset not found: ${request.AssetId}`,
                        RequestId: request.RequestId,
                    }),
                }
            }
            await runPromoteToCanon(request.AssetId, async () => {
                const w = await AssetWorkspace.fromUUID(request.AssetId, { preferDynamo: false, allowS3Fallback: true })
                if (!w) {
                    throw new Error(`Asset not found during promoteToCanon: ${request.AssetId}`)
                }
                return { zone: w.zone as Zone, player: w.player }
            }, {
                streamEvent: promoteToCanonStreamEvent,
                coordinateMoveAsset,
                coordinateCanonizeAsset,
            })
            await messageBus.flushAndSettle()
            return await extractReturnValue(messageBus)
        }
    }

    // Flush messageBus and return after handling either WebSocket or direct Lambda calls
    await messageBus.flushAndSettle()
    return await extractReturnValue(messageBus)
}
