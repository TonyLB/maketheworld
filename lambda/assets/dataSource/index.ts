import { AssetsDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import messageBus from '../messageBus'

//
// Non-replayable DataSource singleton for mtw.assets
// 
// This DataSource handles serving event mesh items for the mtw.assets top-level
// dataSource and processes incoming events that have impacts at the assets level.
// 
// Key responsibilities:
// - Stream asset-level events to EventBridge for real-time subscribers
// - Process incoming events from other data sources that affect assets
// - Handle coordination events (canonization, removal, etc.)
// - Process diagnostic events (healing, global values)
// - Handle player and library update events
//
export const assetsDataSource = new AssetsDataSource({
    dataSourceKey: 'mtw.assets',
    replayable: false, // Non-replayable - focuses on event streaming and processing
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is StreamingEventPayload => {
        // Subscribe to all streaming events from other data sources
        // The specific event processing logic will be in receiveEvents
        return true
    },
    receiveEvents: async ({ event, streamEvent }) => {
        // Process incoming events from other data sources
        // This is where we would handle events that impact the assets level
        
        // For now, we'll just pass through events that are relevant to assets
        // In the future, this could include:
        // - Processing player events that affect asset access
        // - Handling ephemera events that reference assets
        // - Processing coordination events from other services
        
        // Example: If we receive an event that should trigger an asset update
        // await streamEvent({
        //     update: { /* asset update data */ },
        //     streamKey: event.streamKey || 'global',
        //     detailType: 'Asset Updated'
        // })
    }
})

// Subscribe the DataSource to the messageBus for event processing
assetsDataSource.subscribe()

export default assetsDataSource
