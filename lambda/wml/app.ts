import backupWML from "./backupWML";
import internalCache from "./internalCache";
import { S3Client } from "@aws-sdk/client-s3";
import messageBus from "./messageBus";
import type { StreamingEventMessage } from "./messageBus/baseClasses";
import { extractReturnValue } from "./returnValue/index";
import { CoordinationEventExternal, CoordinationEventSerializer } from './dataSource/coordinationSerializer';
import { sendApplyEdit, sendMoveAsset, sendPurgeAsset } from './dataSource/subscribedEvents';
import { sendInitializeSubscription } from './dataSource/initSubscription';
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform';
import { DiagnosticsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics';
import { WMLAPIMessage } from '@tonylb/mtw-interfaces/ts/wml';

// Import DataSources to trigger their messageBus subscriptions (side-effect imports)
import './dataSource'  // mtw.wml DataSource

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.coordination': new CoordinationEventSerializer(),
    'mtw.diagnostics': new DiagnosticsEventSerializer(),
    // Add other data source deserializers here as needed
}

// Type guard for WML API messages
const isWMLAPIMessage = (msg: unknown): msg is WMLAPIMessage => {
    return msg !== null && 
           typeof msg === 'object' && 
           'message' in msg && 
           typeof (msg as any).message === 'string' &&
           ['backupWML', 'applyEdit', 'moveAsset', 'purgeAsset'].includes((msg as any).message)
}

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
            await messageBus.flush()
            return
        }

        // Find the appropriate deserializer for this data source
        const deserializer = eventDeserializers[event.source as keyof typeof eventDeserializers]
        
        if (deserializer) {
            // Convert EventBridge event to CoreExternalFormat using format transformer
            const coreFormat = fromEventBridgeFormat(event)
            const header = {
                dataSourceKey: coreFormat.dataSourceKey,
                streamKey: coreFormat.streamKey,
                timestamp: coreFormat.timestamp,
                type: coreFormat.update.type as string
            }
            // Deserialize the external event to internal format using the serializer
            const internalEvent = deserializer.deserialize({
                dataSourceKey: coreFormat.dataSourceKey,
                streamKey: coreFormat.streamKey,
                externalUpdate: coreFormat.update as any,
                header
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
                const externalMessage: StreamingEventMessage = {
                    type: 'StreamingEvent',
                    dataSourceKey: coreFormat.dataSourceKey,
                    streamKey: coreFormat.streamKey,
                    header,
                    getContentInternal: () => Promise.resolve(internalEvent),
                    timestamp: event.time ? new Date(event.time).getTime() : Date.now()
                }
                messageBus.send(externalMessage)
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
        // Flush messageBus and return after handling EventBridge events
        await messageBus.flush()
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
            await messageBus.flush()
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
            await messageBus.flush()
            return await extractReturnValue(messageBus)
        }
        case 'purgeAsset': {
            const content = {
                type: 'Purge Asset' as const,
                expectedZone: request.expectedZone,
                requireExists: request.requireExists
            }
            sendPurgeAsset(messageBus, request.AssetId, content)
            await messageBus.flush()
            return await extractReturnValue(messageBus)
        }
    }

    // Flush messageBus and return after handling either WebSocket or direct Lambda calls
    await messageBus.flush()
    return await extractReturnValue(messageBus)
}
