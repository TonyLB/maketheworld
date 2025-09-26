import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from './serializers'
import { moveAsset } from './moveAsset'
import { WMLInternalMessage, isWMLInternalMessage, MoveAssetRequest, isMoveAssetRequest } from '../messageBus/baseClasses'
import { CoordinationEventUpdate, isCoordinationEventUpdate, isCoordinationCanonizeEvent, isCoordinationDecanonizeEvent } from './coordinationSerializer'

// Union type constraint for legitimate incoming subscribed events
type WMLSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'internal'
    event: { update: WMLInternalMessage }
}

// Union type constraint for coordination events
type CoordinationSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'mtw.coordination'
    event: { update: CoordinationEventUpdate }
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
export const wmlDataSource = new WMLDataSource<{}, WMLEventUpdate, WMLSubscribedEvent | CoordinationSubscribedEvent, WMLEventExternal>({
    dataSourceKey: 'mtw.wml',
    replayable: false, // Non-replayable - focuses on event streaming and serialization
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is WMLSubscribedEvent | CoordinationSubscribedEvent => {
        // Subscribe to internal moveAssets events for direct API calls
        if (event.dataSourceKey === 'internal' &&
            event.event &&
            typeof event.event === 'object' &&
            isWMLInternalMessage(event.event.update)) {
            return true
        }
        
        // Subscribe to coordination events for canonization/decanonization
        if (event.dataSourceKey === 'mtw.coordination' &&
            event.event &&
            typeof event.event === 'object' &&
            isCoordinationEventUpdate(event.event.update)) {
            return true
        }
        
        return false
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal moveAssets events from direct API calls
        await Promise.all(events.map(async (event) => {
            if (event.dataSourceKey === 'internal' && isMoveAssetRequest(event.event.update)) {
                try {
                    const moveRequest = event.event.update
                    const result = await moveAsset(moveRequest)
                    
                    // Stream zone changed event if move was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Zone Changed',
                                    AssetId: `ASSET#${event.event.update.assetId}`,
                                    fromZone: event.event.update.fromZone,
                                    toZone: event.event.update.toZone,
                                    ...(event.event.update.player && { player: event.event.update.player }),
                                    ...(event.event.update.subFolder && { subFolder: event.event.update.subFolder })
                                },
                                streamKey: `ASSET#${event.event.update.assetId}`,
                                detailType: 'Zone Changed'
                            })
                        } catch (streamError) {
                            console.error(`Error streaming zone changed event for ${event.event.update.assetId}:`, streamError)
                            // Don't fail the move operation if streaming fails
                        }
                    }
                } catch (error) {
                    console.error(`Error processing moveAsset for ${event.event.update.assetId}:`, error)
                }
            }
            
            // Process coordination events for canonization/decanonization
            if (event.dataSourceKey === 'mtw.coordination') {
                try {
                    const coordinationEvent = event.event.update
                    let moveRequest: MoveAssetRequest
                    
                    if (isCoordinationCanonizeEvent(coordinationEvent)) {
                        // Canonize: move from current zone to Canon
                        moveRequest = {
                            type: 'moveAsset',
                            assetId: coordinationEvent.assetId,
                            fromZone: 'Library', // Default from zone for canonization
                            toZone: 'Canon'
                        }
                    } else if (isCoordinationDecanonizeEvent(coordinationEvent)) {
                        // Decanonize: move from Canon to Library
                        moveRequest = {
                            type: 'moveAsset',
                            assetId: coordinationEvent.assetId,
                            fromZone: 'Canon',
                            toZone: 'Library'
                        }
                    } else {
                        console.error(`Unknown coordination event type: ${JSON.stringify(coordinationEvent)}`)
                        return
                    }
                    
                    const result = await moveAsset(moveRequest)
                    
                    // Stream zone changed event if move was successful
                    if (result.success) {
                        try {
                            await streamEvent({
                                update: {
                                    type: 'Zone Changed',
                                    AssetId: `ASSET#${coordinationEvent.assetId}`,
                                    fromZone: moveRequest.fromZone,
                                    toZone: moveRequest.toZone
                                },
                                streamKey: `ASSET#${coordinationEvent.assetId}`,
                                detailType: 'Zone Changed'
                            })
                        } catch (streamError) {
                            console.error(`Error streaming zone changed event for ${coordinationEvent.assetId}:`, streamError)
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
