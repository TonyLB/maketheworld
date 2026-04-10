/**
 * mtw.ephemera.perception DataSource (stub).
 *
 * Bus-only, non-replayable. Subscribes via placeholder ingress guard; receiveEvents is a no-op until
 * real ingress and aggregation land. See task plan:
 * taskPlanning/lambda/ephemera/dataSource/perception/AGENT.perceptionRefactor.planning.md
 */
import EphemeraDataSource from '../abstract'
import type { PerceptionStubPublishedPayload } from './publishedEvents'
import type { PerceptionIngressPlaceholderPayload } from './subscribedEvents'
import { isPerceptionSubscribedEnvelope } from './subscribedEvents'

export const ephemeraPerceptionDataSource = new EphemeraDataSource<
    never,
    PerceptionStubPublishedPayload,
    PerceptionIngressPlaceholderPayload
>({
    dataSourceKey: 'mtw.ephemera.perception',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isPerceptionSubscribedEnvelope,
    receiveEvents: async () => {
        // Stub: no production envelopes match the placeholder guard yet.
    },
})

ephemeraPerceptionDataSource.subscribe()

export default ephemeraPerceptionDataSource
