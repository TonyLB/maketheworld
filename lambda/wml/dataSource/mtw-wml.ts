import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { WMLEventSerializer } from './serializers'
import { moveAsset, MoveAssetRequest, isMoveAssetRequest } from './moveAsset'

// Union type constraint for legitimate incoming subscribed events
type WMLSubscribedEvent = StreamingEventPayload & {
    dataSourceKey: 'internal'
    detailType: 'moveAssets'
    event: { update: MoveAssetRequest }
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
export const wmlDataSource = new WMLDataSource<{}, StandardForm, WMLSubscribedEvent>({
    dataSourceKey: 'mtw.wml',
    replayable: false, // Non-replayable - focuses on event streaming and serialization
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is WMLSubscribedEvent => {
        // Subscribe to internal moveAssets events for direct API calls
        return (
            event.dataSourceKey === 'internal' &&
            event.event &&
            typeof event.event === 'object' &&
            event.event !== null &&
            isMoveAssetRequest(event.event.update)
        )
    },
    receiveEvents: async ({ events }) => {
        // Process internal moveAssets events from direct API calls
        await Promise.all(events.map(async (event) => {
            if (event.dataSourceKey === 'internal') {
                try {
                    const result = await moveAsset(event.event.update)
                    console.log(`moveAsset result for ${event.event.update.assetId}:`, result)
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
