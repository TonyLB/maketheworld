import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { WMLEventSerializer, WMLEventUpdate, WMLEventExternal } from './serializers'
import { moveAsset } from './moveAsset'
import { WMLInternalMessage, isWMLInternalMessage, MoveAssetRequest } from '../messageBus/baseClasses'

// Union type constraint for legitimate incoming subscribed events
type WMLSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'internal'
    event: { update: WMLInternalMessage }
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
        // Subscribe to internal moveAssets events for direct API calls
        return Boolean(
            event.dataSourceKey === 'internal' &&
            event.event &&
            typeof event.event === 'object' &&
            isWMLInternalMessage(event.event.update)
        )
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // Process internal moveAssets events from direct API calls
        await Promise.all(events.map(async (event) => {
            if (event.dataSourceKey === 'internal') {
                try {
                    // WMLInternalMessage is now just MoveAssetRequest
                    const moveRequest = event.event.update as WMLInternalMessage
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
        }))
    },
    eventSerializer: new WMLEventSerializer()
})

// Subscribe the DataSource to the messageBus for event processing
wmlDataSource.subscribe()

export default wmlDataSource
