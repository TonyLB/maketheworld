import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { WMLEventSerializer } from './serializers'

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
export const wmlDataSource = new WMLDataSource<{}, StandardForm>({
    dataSourceKey: 'mtw.wml',
    replayable: false, // Non-replayable - focuses on event streaming and serialization
    // No snapshotContentGenerator needed for non-replayable data sources
    subscribedEventTypeGuard: (event: StreamingEventPayload): event is never => {
        // TODO: Define what events this data source should subscribe to
        // For now, subscribing to nothing as requested
        return false
    },
    receiveEvents: async ({ events, streamEvent }) => {
        // TODO: Implement event processing logic
        // For now, this is a stub as requested
        console.log('WML DataSource received events:', events)
    },
    eventSerializer: new WMLEventSerializer()
})

// Subscribe the DataSource to the messageBus for event processing
wmlDataSource.subscribe()

export default wmlDataSource
