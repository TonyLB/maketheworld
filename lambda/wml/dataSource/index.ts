import { wmlDataSource as wmlDataSourceInstance } from './mtw-wml'
import messageBus from '../messageBus'

export { WMLDataSource } from './abstract'
// Re-export WML event types from mtw-interfaces for convenience
export { WMLEventSerializer, WMLContentEvent, WMLZoneEvent, WMLEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/wml'

export const wmlDataSource = wmlDataSourceInstance

// Subscribe the DataSource to the messageBus for event processing
// Note: messageBus is already configured in the constructor, so subscribe() uses this.messageBus
wmlDataSource.subscribe()

export default wmlDataSource