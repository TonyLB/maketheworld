import { parseWMLHandler } from './parseWML'
import copyWML from './copyWML';
import { resetWML } from './resetWML';
import backupWML from "./backupWML";
import applyEdit from "./applyEdit";
import { checkLock, requestLock, yieldAtomicLock } from "./atomicLock";
import delayPromise from "@tonylb/mtw-utilities/ts/dynamoDB/delayPromise";
import internalCache from "./internalCache";
import { S3Client } from "@aws-sdk/client-s3";
import messageBus from "./messageBus";
import { extractReturnValue } from "./returnValue/index";
import { CoordinationEventExternal, CoordinationEventSerializer, CoordinationEventUpdate } from './dataSource/coordinationSerializer';
import { fromEventBridgeFormat } from '@tonylb/mtw-lambda-patterns/ts/dataSource/formatTransform';

const params = { region: process.env.AWS_REGION }
const s3Client = new S3Client(params)

// Event deserializers for incoming EventBridge events
const eventDeserializers = {
    'mtw.coordination': new CoordinationEventSerializer(),
    // Add other data source deserializers here as needed
}

export const handler = async (event: any) => {

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
                externalUpdate: coreFormat.update as CoordinationEventExternal
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
                    dataSourceKey: coreFormat.dataSourceKey as 'internal',
                    streamKey: coreFormat.streamKey,
                    event: internalEvent as CoordinationEventUpdate,
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

    switch(event.message) {
        case 'parseWML':
            return await parseWMLHandler(event)
        case 'copyWML':
            return await copyWML(event)
        case 'backupWML':
            return await backupWML(event)
        case 'resetWML':
            if (event.address.zone === 'Draft') {
                return await resetWML({
                    ...event,
                    key: `draft[${event.address.player}]`
                })
            }
            else {
                return await resetWML(event)
            }
        case 'requestLock':
            const lock = await requestLock(event.AssetId)
            return await checkLock(event.AssetId, lock)
        case 'checkLock':
            await delayPromise(500)
            return await checkLock(event.AssetId, event.lock, event.timeoutCounter)
        case 'yieldLock':
            await yieldAtomicLock(event.AssetId, event.lock)
            return {}
        case 'applyEdit':
            return await applyEdit(event)
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

    // Flush any EventBridge events that were processed
    await messageBus.flush()
    return await extractReturnValue(messageBus)
}
