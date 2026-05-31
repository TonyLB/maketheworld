/**
 * affordanceOrchestration ingress envelope guards and typed send-helpers.
 *
 * Part of mtw.ephemera.affordanceOrchestration (see ../AGENT.md).
 * Internal-only publish path uses dataSourceKey 'api.ephemera'; stream outbounds are defined in publishedEvents.ts.
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import type {
    AffordanceOrchestrationIngressCommand,
    AffordancesRequestedCommand,
} from './localApiEvents'
import type { ComponentTopologyInvalidatedEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/assets/componentTopology'
import { isComponentTopologyInvalidatedEnvelope } from '../affordanceCache/subscribedEvents'
import {
    isEphemeraObjectsObjectsChangedEnvelope,
    type ObjectsChangedPayload,
} from '../objects/events'

export type AffordanceOrchestrationIngressHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Affordances Requested' }

export type AffordanceOrchestrationIngressEvent = {
    header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Affordances Requested' };
    getContent: () => Promise<AffordancesRequestedCommand>;
}

const isAffordancesRequestedHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Affordances Requested' }
> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Affordances Requested' } => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Affordances Requested'
)

export const isAffordancesRequestedIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    AffordancesRequestedCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Affordances Requested' }
>(isAffordancesRequestedHeader)

export const isAffordanceOrchestrationIngressHeader: HeaderGuard<AffordanceOrchestrationIngressHeader> = (
    header
): header is AffordanceOrchestrationIngressHeader => (
    isAffordancesRequestedHeader(header)
)

export const isAffordanceOrchestrationIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    AffordanceOrchestrationIngressCommand,
    AffordanceOrchestrationIngressHeader
>(isAffordanceOrchestrationIngressHeader)

export type AffordanceOrchestrationSubscribedContent =
    | AffordanceOrchestrationIngressCommand
    | ObjectsChangedPayload
    | ComponentTopologyInvalidatedEvent

export const isAffordanceOrchestrationSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AffordanceOrchestrationSubscribedContent> => (
    isAffordanceOrchestrationIngressEnvelope(envelope)
        || isEphemeraObjectsObjectsChangedEnvelope(envelope)
        || isComponentTopologyInvalidatedEnvelope(envelope)
)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

/** Stable message-bus lane for an affordance-orchestration work unit; matches ingress {@link sendAffordancesRequested}. */
export function affordanceOrchestrationIngressLaneId(streamKey: string): string {
    return `affordanceOrchestration:${streamKey}`
}

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...(content as Record<string, unknown>),
    }),
}

export type SendAffordancesRequestedOptions = {
    /**
     * When set, the message is on the default bus lane so an in-flight `flush` picks it up.
     * Otherwise uses {@link affordanceOrchestrationIngressLaneId}.
     */
    useDefaultMessageBusLane?: boolean
}

export function sendAffordancesRequested(
    bus: Bus,
    streamKey: string,
    content: AffordancesRequestedCommand,
    options?: SendAffordancesRequestedOptions
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Affordances Requested',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    const message = {
        type: 'StreamingEvent' as const,
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    if (options?.useDefaultMessageBusLane) {
        bus.send(message)
    } else {
        bus.send(
            message,
            affordanceOrchestrationIngressLaneId(streamKey),
        )
    }
}
