/**
 * mtw.ephemera.state DataSource (stub).
 *
 * Internal-only, non-replayable, bus-only publisher strategy. No ingress guards or
 * receiveEvents yet --- subscribe() registers nothing on the message bus until event
 * types are added. See lambda/ephemera/state/AGENT.v3.planning.md.
 */
import EphemeraDataSource from '../abstract'

export const ephemeraStateDataSource = new EphemeraDataSource<never, never, never>({
    dataSourceKey: 'mtw.ephemera.state',
    replayable: false,
    publisherStrategy: 'busOnly',
})

ephemeraStateDataSource.subscribe()

export default ephemeraStateDataSource
