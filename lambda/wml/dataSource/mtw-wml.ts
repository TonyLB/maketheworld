import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'
import { moveAsset } from './moveAsset'
import { applyEdit } from './applyEdit'
import { CoordinationEventUpdate, isCoordinationEventUpdate, isCoordinationCanonizeEvent, isCoordinationDecanonizeEvent, isMoveAssetRequest, isApplyEditRequest, MoveAssetRequest } from './coordinationSerializer'
import { DiagnosticsEventUpdate, isS3StructureFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'
import { isSchemaAssetUUID } from "@tonylb/mtw-base/ts/schema"
import { initializePrimitives } from './initializePrimitives'

// Union type constraint for legitimate incoming subscribed events
type WMLSubscribedEvent = 
    | (StreamingEventPayload & {
        dataSourceKey: 'internal';
        streamKey: string;
        event: CoordinationEventUpdate;
    })
    | (StreamingEventPayload & {
        dataSourceKey: 'mtw.diagnostics';
        streamKey: string;
        event: DiagnosticsEventUpdate;
    })

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
        // Subscribe to:
        // 1. Internal coordination events (direct API calls)
        // 2. mtw.diagnostics events (system health findings)
        return Boolean(
            (event.dataSourceKey === 'internal' &&
                event.event &&
                typeof event.event === 'object' &&
                isCoordinationEventUpdate(event.event)) ||
            (event.dataSourceKey === 'mtw.diagnostics' &&
                event.event &&
                typeof event.event === 'object')
        )
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal coordination events from direct API calls and EventBridge
        await Promise.all(events.map(async (event) => {
            const payload = event.event as any
            
            // Handle Apply Edit events
            if (isApplyEditRequest(payload) && isSchemaAssetUUID(event.streamKey)) {
                try {
                    const result = await applyEdit({
                        AssetId: event.streamKey,
                        RequestId: payload.RequestId,
                        schema: payload.schema
                    })
                    
                    if (result.success) {
                        // Stream Content Update event
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Content Update',
                                    schema: result.schema
                                },
                                streamKey: event.streamKey
                            })
                        } catch (streamError) {
                            console.error(`Error streaming Content Update event for ${event.streamKey}:`, streamError)
                            // Don't fail the edit operation if streaming fails
                        }
                    } else {
                        // Stream Merge Conflict event
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Merge Conflict',
                                    error: result.error
                                },
                                streamKey: event.streamKey
                            })
                        } catch (streamError) {
                            console.error(`Error streaming Merge Conflict event for ${event.streamKey}:`, streamError)
                        }
                    }
                } catch (error) {
                    console.error(`Error processing applyEdit for ${event.streamKey}:`, error)
                }
            }
            
            // Handle Move Asset events
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
            
            // Handle mtw.diagnostics S3 Structure Finding events
            if (isS3StructureFindingEvent(payload)) {
                // Respond to missing primitives.wml
                if (payload.source === 'primitives.wml' && payload.status === 'missing') {
                    try {
                        const result = await initializePrimitives()
                    } catch (error) {
                        console.error(`WML DataSource: Error initializing primitives:`, error)
                    }
                }
                // Future: Handle other S3 Structure Finding events here
            }
        }))
    },
    eventSerializer: new WMLEventSerializer()
})

// Subscribe the DataSource to the messageBus for event processing
wmlDataSource.subscribe()

export default wmlDataSource
