/**
 * mtw.ephemera.objects DataSource (v1).
 *
 * Bus-only, non-replayable. Subscribes to api.ephemera **Objects Change**; persists room object lists on `Meta::Room`.
 */
import EphemeraDataSource from '../abstract'
import { isEphemeraApiObjectsChangeEnvelope } from './subscribedEvents'
import type { ObjectsChangeCommand } from '../localApiEvents'
import { handleApiObjectsChangeCommand } from './handleApiObjectsChange'
import type { ObjectsChangedPayload } from './events'

export const ephemeraObjectsDataSource = new EphemeraDataSource<never, ObjectsChangedPayload, ObjectsChangeCommand>({
    dataSourceKey: 'mtw.ephemera.objects',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraApiObjectsChangeEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const cmd = await event.getContent()
            await handleApiObjectsChangeCommand(cmd, { streamEvent })
        }))
    },
})

ephemeraObjectsDataSource.subscribe()

export default ephemeraObjectsDataSource
