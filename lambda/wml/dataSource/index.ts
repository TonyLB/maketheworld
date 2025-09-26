import { wmlDataSource as wmlDataSourceInstance } from './mtw-wml'
import messageBus from '../messageBus'

export { WMLDataSource } from './abstract'
export { WMLEventSerializer, WMLContentEvent, WMLZoneEvent, WMLEventUpdate } from './serializers'

export const wmlDataSource = wmlDataSourceInstance

// Subscribe the DataSource to the messageBus for event processing
wmlDataSource.subscribe(messageBus)

export default wmlDataSource