/**
 * mtw.ephemera.state DataSource (evolving).
 *
 * Internal-only, non-replayable, bus-only publisher strategy.
 * Subscribes to api.ephemera **State Change** envelopes; persists room marks via `mergePersistMetaRoomMarks`.
 * Optional `assetStack` on that command is TEMPORARY scaffolding (see `StateChangeCommand` in `localApiEvents.ts`).
 * See ./AGENT.v3.planning.md (same package).
 */
import EphemeraDataSource from '../abstract'
import { isEphemeraApiStateChangeEnvelope } from '../apiEphemera'
import type { StateChangeCommand } from '../localApiEvents'
import { handleApiStateChangeCommand } from './handleApiStateChange'

export const ephemeraStateDataSource = new EphemeraDataSource<never, never, StateChangeCommand>({
    dataSourceKey: 'mtw.ephemera.state',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isEphemeraApiStateChangeEnvelope,
    receiveEvents: async ({ events }) => {
        await Promise.all(events.map(async (event) => {
            const cmd = await event.getContent()
            await handleApiStateChangeCommand(cmd)
        }))
    },
})

ephemeraStateDataSource.subscribe()

export default ephemeraStateDataSource
