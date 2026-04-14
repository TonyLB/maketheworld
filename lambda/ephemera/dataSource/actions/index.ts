/**
 * mtw.ephemera.actions DataSource.
 *
 * Inert bus-only stub for local coordination scaffolding. Ingress wiring follows.
 */
import EphemeraDataSource from '../abstract'
import type { ActionsStubPublishedPayload } from './publishedEvents'
import type { ActionsSubscribedContent } from './subscribedEvents'
import { isActionsSubscribedEnvelope } from './subscribedEvents'

export const ephemeraActionsDataSource = new EphemeraDataSource<
    never,
    ActionsStubPublishedPayload,
    ActionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.actions',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isActionsSubscribedEnvelope,
    receiveEvents: async () => {},
})

ephemeraActionsDataSource.subscribe()

export default ephemeraActionsDataSource
