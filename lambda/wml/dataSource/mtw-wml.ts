import { WMLDataSource } from './abstract'
import { StreamingEventPayload } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { schemaToWML } from '@tonylb/mtw-wml/ts/schema'
import { nodeFromWML } from '@tonylb/mtw-wml/ts/schema'

/**
 * Serializer/Deserializer for WML format events
 * 
 * This handles the conversion between:
 * - Internal StandardForm objects (for messageBus communication)
 * - WML string format (for EventBridge transmission)
 */
export class WMLEventSerializer implements DataSourceEventSerializer<StandardForm, string> {
    /**
     * Serialize a StandardForm to WML string format
     * for EventBridge transmission
     */
    serialize({ update }: { update: StandardForm }): string {
        // Convert StandardForm to WML string
        return schemaToWML([update.schema])
    }

    /**
     * Deserialize a WML string back to StandardForm
     * for internal messageBus processing
     */
    deserialize(params: { dataSourceKey: string; detailType: string; streamKey: string; externalUpdate: string }): StandardForm | null {
        try {
            // Parse WML string back to StandardForm
            const schemaNode = nodeFromWML(params.externalUpdate)
            return new StandardForm(schemaNode)
        } catch (error) {
            throw new Error(`Failed to deserialize WML: ${error instanceof Error ? error.message : String(error)}`)
        }
    }
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
