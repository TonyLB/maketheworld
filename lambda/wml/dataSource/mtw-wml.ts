import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from './serializers'
import { moveAsset } from './moveAsset'
import { CoordinationEventUpdate, isCoordinationEventUpdate, isCoordinationCanonizeEvent, isCoordinationDecanonizeEvent, isMoveAssetRequest, MoveAssetRequest } from './coordinationSerializer'
import { isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"

// Union type constraint for legitimate incoming subscribed events
type WMLSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'internal';
    streamKey: string;
    event: CoordinationEventUpdate
}

//
// Non-replayable DataSource singleton for mtw.wml
// 
// This DataSource handles WML-specific events and provides serialization/deserialization
// between internal StandardForm objects and WML string format.
// 
// Key responsibilities:
// - Serialize StandardForm to WML format for EventBridge events
// - Deserialize incoming WML format events back to StandardForm for processing
// - Handle WML-specific event processing (currently stubbed)
// - Provide the foundation for future WML lambda refactoring
//
export const wmlDataSource = new WMLDataSource<{}, WMLEventUpdate, WMLSubscribedEvent, WMLEventExternal>({
    dataSourceKey: 'mtw.wml',
    replayable: false, // Non-replayable - focuses on event streaming and serialization
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is WMLSubscribedEvent => {
        // Subscribe to internal Move Asset events for direct API calls
        return Boolean(event.dataSourceKey === 'internal' &&
            event.event &&
            typeof event.event === 'object' &&
            isCoordinationEventUpdate(event.event))
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal Move Asset events from direct API calls
        await Promise.all(events.map(async (event) => {
            const payload = event.event as any
            if (isMoveAssetRequest(payload) && isSchemaAssetUUID(event.streamKey)) {
                try {
                    const moveRequest = payload
                    const result = await moveAsset(event.streamKey, moveRequest)
                    
                    // Stream zone changed event if move was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Zone Changed',
                                    fromZone: payload.fromZone,
                                    toZone: payload.toZone,
                                    ...(payload.player ? { player: payload.player } : {}),
                                    ...(payload.subFolder ? { subFolder: payload.subFolder } : {})
                                },
                                streamKey: event.streamKey
                            })
                        } catch (streamError) {
                            console.error(`Error streaming zone changed event for ${event.streamKey}:`, streamError)
                            // Don't fail the move operation if streaming fails
                        }
                    }
                } catch (error) {
                    console.error(`Error processing moveAsset for ${event.streamKey}:`, error)
                }
            }
            
            // Process coordination events for canonization/decanonization
            if ((isCoordinationCanonizeEvent(payload) || isCoordinationDecanonizeEvent(payload)) && isSchemaAssetUUID(event.streamKey)) {
                try {
                    const coordinationEvent = payload
                    let moveRequest: MoveAssetRequest
                    
                    if (isCoordinationCanonizeEvent(coordinationEvent)) {
                        // Canonize: move from current zone to Canon
                        moveRequest = {
                            type: 'Move Asset',
                            fromZone: 'Library', // Default from zone for canonization
                            toZone: 'Canon'
                        }
                    } else if (isCoordinationDecanonizeEvent(coordinationEvent)) {
                        // Decanonize: move from Canon to Library
                        moveRequest = {
                            type: 'Move Asset',
                            fromZone: 'Canon',
                            toZone: 'Library'
                        }
                    } else {
                        console.error(`Unknown coordination event type: ${JSON.stringify(coordinationEvent)}`)
                        return
                    }
                    
                    const result = await moveAsset(event.streamKey, moveRequest)
                    
                    // Stream zone changed event if move was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Zone Changed',
                                    fromZone: moveRequest.fromZone,
                                    toZone: moveRequest.toZone
                                },
                                streamKey: event.streamKey
                            })
                        } catch (streamError) {
                            console.error(`Error streaming zone changed event for ${event.streamKey}:`, streamError)
                            // Don't fail the move operation if streaming fails
                        }
                    }
                } catch (error) {
                    console.error(`Error processing coordination event:`, error)
                }
            }
        }))
    },
    eventSerializer: new WMLEventSerializer()
})

// Subscribe the DataSource to the messageBus for event processing
wmlDataSource.subscribe()

export default wmlDataSource
