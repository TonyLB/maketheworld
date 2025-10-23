import backupWML from "./backupWML";
import internalCache from "./internalCache";
import { S3Client } from "@aws-sdk/client-s3";
import messageBus from "./messageBus";
import { extractReturnValue } from "./returnValue/index";
import { CoordinationEventExternal, CoordinationEventSerializer, CoordinationEventUpdate } from './dataSource/coordinationSerializer';
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform';
import { DiagnosticsEventSerializer } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics';
import { WMLAPIMessage, isApplyEditAPIMessage, isMoveAssetAPIMessage } from '@tonylb/mtw-interfaces/ts/wml';

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

export const handler = async (event: any) => {

    // Parse WebSocket API Gateway events (similar to assets lambda pattern)
    const request = (event.body && JSON.parse(event.body) || undefined) as WMLAPIMessage | undefined
    const { connectionId } = request?.connectionId || event.requestContext || {}

    internalCache.clear()
    internalCache.Connection.set({ key: 's3Client', value: s3Client })
    messageBus.clear()

    // Handle EventBridge messages by publishing to messageBus for DataSource processing
    if (event?.source && event["detail-type"]) {
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
                    dataSourceKey: coreFormat.dataSourceKey as any,
                    streamKey: coreFormat.streamKey,
                    event: internalEvent as any,
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
        // Flush messageBus and return after handling EventBridge events
        await messageBus.flush()
        return
    }

    // Handle WebSocket API Gateway calls (similar to assets lambda pattern)
    if (request && isApplyEditAPIMessage(request)) {
        messageBus.send({
            type: 'StreamingEvent',
            dataSourceKey: 'internal',
            streamKey: request.AssetId,
            event: {
                type: 'Apply Edit',
                RequestId: request.RequestId ?? '',
                schema: request.schema
            },
            timestamp: Date.now()
        })
    } else {
        switch(event.message) {
            case 'backupWML':
                return await backupWML(event)
            
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
            case 'applyEdit':
                // Handle direct Lambda calls (from event)
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: 'internal',
                    streamKey: event.AssetId,
                    event: {
                        type: 'Apply Edit',
                        RequestId: event.RequestId ?? '',
                        schema: event.schema
                    },
                    timestamp: Date.now()
                })
                await messageBus.flush()
                return await extractReturnValue(messageBus)
            case 'moveAsset':
                messageBus.send({
                    type: 'StreamingEvent',
                    dataSourceKey: 'internal',
                    streamKey: event.AssetId,
                    event: {
                        type: 'Move Asset',
                        fromZone: event.fromZone,
                        toZone: event.toZone,
                        player: event.player,
                        subFolder: event.subFolder
                    },
                    timestamp: Date.now()
                })
                await messageBus.flush()
                return await extractReturnValue(messageBus)
        }
    }

    // Flush messageBus and return after handling either WebSocket or direct Lambda calls
    await messageBus.flush()
    return await extractReturnValue(messageBus)
}
