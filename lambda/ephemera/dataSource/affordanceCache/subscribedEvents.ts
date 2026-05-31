/**
 * Envelope guards for mtw.ephemera.affordanceCache DataSource subscriptions.
 */
import {
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
    type StreamingEventEnvelope,
    type StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type { ComponentTopologyInvalidatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'
import {
    isAffordanceOrchestrationPublishedStreamEnvelope,
    type AffordanceOrchestrationPublishedPayload,
} from '../affordanceOrchestration/publishedEvents'

export type AffordanceCacheSubscribedContent =
    | AffordanceOrchestrationPublishedPayload
    | ComponentTopologyInvalidatedEvent

export type AffordanceCacheSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.affordanceOrchestration'; type: string })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentTopology'; type: 'TopologyInvalidated' })

const isComponentTopologyInvalidatedHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentTopology'; type: 'TopologyInvalidated' }
> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentTopology'; type: 'TopologyInvalidated' } =>
    h.dataSourceKey === 'mtw.assets.componentTopology' && h.type === 'TopologyInvalidated'

export const isComponentTopologyInvalidatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ComponentTopologyInvalidatedEvent,
    StreamingEventHeader & { dataSourceKey: 'mtw.assets.componentTopology'; type: 'TopologyInvalidated' }
>(isComponentTopologyInvalidatedHeader)

export const isAffordanceCacheSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AffordanceCacheSubscribedContent> => (
    isAffordanceOrchestrationPublishedStreamEnvelope(envelope)
    || isComponentTopologyInvalidatedEnvelope(envelope)
)
