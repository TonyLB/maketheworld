/**
 * mtw.ephemera.coyoteGame DataSource.
 *
 * Bus-only stub: no subscriptions or published stream events yet. Future: consume
 * internal bus traffic (e.g. mtw.ephemera.actions) and emit Coyote-specific responses.
 */
import EphemeraDataSource from '../abstract'
import type { CoyoteGamePublishedPayload } from './publishedEvents'

export const ephemeraCoyoteGameDataSource = new EphemeraDataSource<
    never,
    CoyoteGamePublishedPayload,
    CoyoteGamePublishedPayload
>({
    dataSourceKey: 'mtw.ephemera.coyoteGame',
    replayable: false,
    publisherStrategy: 'busOnly',
})

ephemeraCoyoteGameDataSource.subscribe()

export default ephemeraCoyoteGameDataSource
