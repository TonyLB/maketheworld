/**
 * mtw.ephemera.state DataSource (evolving).
 *
 * Internal-only, non-replayable, bus-only publisher strategy.
 * Subscribes to api.ephemera **State Change** envelopes; persists room marks via `mergePersistMetaRoomMarks`.
 * See ./AGENT.planning.perceptionVertical.md (same package).
 */
import EphemeraDataSource from '../abstract'
import { isEphemeraApiStateChangeEnvelope } from '../apiEphemera'
import type { StateChangeCommand } from '../localApiEvents'
import { handleApiStateChangeCommand } from './handleApiStateChange'
import type { StateChangedPayload } from './events'

export const ephemeraStateDataSource = new EphemeraDataSource<never, StateChangedPayload, StateChangeCommand>({
    dataSourceKey: 'mtw.ephemera.state',
    replayable: false,
    outboundBusDelivery: 'publish',
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraApiStateChangeEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        await Promise.all(events.map(async (event) => {
            const cmd = await event.getContent()
            await handleApiStateChangeCommand(cmd, { streamEvent })
        }))
    },
})

ephemeraStateDataSource.subscribe()

export default ephemeraStateDataSource
