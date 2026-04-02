/**
 * mtw.ephemera.state DataSource (evolving).
 *
 * Internal-only, non-replayable, bus-only publisher strategy.
 * Subscribes to api.ephemera **State Change** envelopes (componentId + markState); handler is a
 * stub until AGENT.v3 migration. See ./AGENT.v3.planning.md (same package).
 */
import EphemeraDataSource from '../abstract'
import { isEphemeraApiStateChangeEnvelope } from '../apiEphemera'
import type { StateChangeCommand } from '../localApiEvents'

export const ephemeraStateDataSource = new EphemeraDataSource<never, never, StateChangeCommand>({
    dataSourceKey: 'mtw.ephemera.state',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraApiStateChangeEnvelope,
    receiveEvents: async () => {
        // Stub: no-op until state domain reacts (persist Meta::Room, publish mtw.ephemera.state, etc.)
    },
})

ephemeraStateDataSource.subscribe()

export default ephemeraStateDataSource
