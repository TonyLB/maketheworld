/**
 * Outgoing stream payloads for mtw.ephemera.affordanceOrchestration (bus-only DataSource).
 * See ./AGENT.md (v1: Slice Ready, Orchestration Error).
 */
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { isPerspective, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'

export const AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY = 'mtw.ephemera.affordanceOrchestration' as const

export const AFFORDANCE_ORCHESTRATION_PUBLISHED_EVENT_TYPES = [
    'Slice Ready',
    'Orchestration Error',
    'Enrichment Started',
    'Enrichment Complete',
    'Enrichment Deferred',
] as const

export type AffordanceOrchestrationPublishedEventType =
    (typeof AFFORDANCE_ORCHESTRATION_PUBLISHED_EVENT_TYPES)[number]

/** Lean routing on affordance orchestration outbounds (roomId, perspective, perspectiveKey). */
export type AffordanceOrchestrationPublishedRouting = {
    roomId: EphemeraRoomId;
    perspective: Perspective;
    perspectiveKey: string;
}

export type AffordanceOrchestrationSliceReadyPayload = AffordanceOrchestrationPublishedRouting & {
    type: 'Slice Ready';
}

export type AffordanceOrchestrationOrchestrationErrorPayload = AffordanceOrchestrationPublishedRouting & {
    type: 'Orchestration Error';
    errorCode: string;
    errorMessage: string;
}

export type AffordanceOrchestrationEnrichmentStartedPayload = AffordanceOrchestrationPublishedRouting & {
    type: 'Enrichment Started';
    /**
     * Optional hook for forward compatibility if we later distinguish sub-states under
     * Enrichment Started. Omitted today; not required for routing.
     */
    phase?: 'enriching';
}

export type AffordanceOrchestrationEnrichmentCompletePayload = AffordanceOrchestrationPublishedRouting & {
    type: 'Enrichment Complete';
    /** Provisional until LLM enrichment slice lands; shape TBD in contract tests. */
    enrichmentId?: string;
}

export type AffordanceOrchestrationEnrichmentDeferredPayload = AffordanceOrchestrationPublishedRouting & {
    type: 'Enrichment Deferred';
    reason: string;
    policy?: string;
}

export type AffordanceOrchestrationPublishedPayload =
    | AffordanceOrchestrationSliceReadyPayload
    | AffordanceOrchestrationOrchestrationErrorPayload
    | AffordanceOrchestrationEnrichmentStartedPayload
    | AffordanceOrchestrationEnrichmentCompletePayload
    | AffordanceOrchestrationEnrichmentDeferredPayload

const hasValidRouting = (v: Record<string, unknown>): boolean => (
    typeof v.roomId === 'string'
    && isEphemeraRoomId(v.roomId)
    && isPerspective(v.perspective)
    && typeof v.perspectiveKey === 'string'
)

export const isAffordanceOrchestrationSliceReadyPayload = (
    value: unknown
): value is AffordanceOrchestrationSliceReadyPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return v.type === 'Slice Ready' && hasValidRouting(v)
}

export const isAffordanceOrchestrationOrchestrationErrorPayload = (
    value: unknown
): value is AffordanceOrchestrationOrchestrationErrorPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    return (
        v.type === 'Orchestration Error'
        && hasValidRouting(v)
        && typeof v.errorCode === 'string'
        && typeof v.errorMessage === 'string'
    )
}

export const isAffordanceOrchestrationEnrichmentStartedPayload = (
    value: unknown
): value is AffordanceOrchestrationEnrichmentStartedPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Enrichment Started' || !hasValidRouting(v)) {
        return false
    }
    if (v.phase !== undefined && v.phase !== 'enriching') {
        return false
    }
    return true
}

export const isAffordanceOrchestrationEnrichmentCompletePayload = (
    value: unknown
): value is AffordanceOrchestrationEnrichmentCompletePayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Enrichment Complete' || !hasValidRouting(v)) {
        return false
    }
    if (v.enrichmentId !== undefined && typeof v.enrichmentId !== 'string') {
        return false
    }
    return true
}

export const isAffordanceOrchestrationEnrichmentDeferredPayload = (
    value: unknown
): value is AffordanceOrchestrationEnrichmentDeferredPayload => {
    if (!value || typeof value !== 'object') {
        return false
    }
    const v = value as Record<string, unknown>
    if (v.type !== 'Enrichment Deferred' || !hasValidRouting(v) || typeof v.reason !== 'string') {
        return false
    }
    if (v.policy !== undefined && typeof v.policy !== 'string') {
        return false
    }
    return true
}

export const isAffordanceOrchestrationPublishedPayload = (
    value: unknown
): value is AffordanceOrchestrationPublishedPayload => (
    isAffordanceOrchestrationSliceReadyPayload(value)
    || isAffordanceOrchestrationOrchestrationErrorPayload(value)
    || isAffordanceOrchestrationEnrichmentStartedPayload(value)
    || isAffordanceOrchestrationEnrichmentCompletePayload(value)
    || isAffordanceOrchestrationEnrichmentDeferredPayload(value)
)

const isAffordanceOrchestrationPublishedHeaderType = (
    type: string
): type is AffordanceOrchestrationPublishedEventType => (
    (AFFORDANCE_ORCHESTRATION_PUBLISHED_EVENT_TYPES as readonly string[]).includes(type)
)

/**
 * Message-bus filter for consumers (e.g. mtw.ephemera.affordanceCache) that subscribe to orchestration outbounds.
 */
export const isAffordanceOrchestrationPublishedStreamEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AffordanceOrchestrationPublishedPayload> => (
    envelope.header.dataSourceKey === AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY
    && isAffordanceOrchestrationPublishedHeaderType(envelope.header.type)
)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

export type PublishAffordanceOrchestrationStreamOptions = {
    /** Non-empty: that lane. Empty string: default lane. Omit: inherit DataSource inbound flush lane in `receiveEvents`. */
    laneId?: string
}

const orchestrationPublishSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...(content as Record<string, unknown>),
    }),
}

export async function publishAffordanceOrchestrationStreamEvent(
    streamEvent: StreamEventFunction<AffordanceOrchestrationPublishedPayload>,
    streamKey: string,
    content: AffordanceOrchestrationPublishedPayload,
    options?: PublishAffordanceOrchestrationStreamOptions,
): Promise<void> {
    await streamEvent({
        update: content,
        streamKey,
        header: { type: content.type },
        ...(options?.laneId !== undefined ? { laneId: options.laneId } : {}),
    })
}

export function streamEventFromMessageBus(bus: Bus): StreamEventFunction<AffordanceOrchestrationPublishedPayload> {
    return async (params) => {
        sendAffordanceOrchestrationPublish(bus, params.streamKey, params.update, params.laneId)
    }
}

export function sendAffordanceOrchestrationPublish(
    bus: Bus,
    streamKey: string,
    content: AffordanceOrchestrationPublishedPayload,
    laneId?: string,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: content.type,
    }
    const envelope = createInternalOriginEnvelope(header, content, orchestrationPublishSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: AFFORDANCE_ORCHESTRATION_DATA_SOURCE_KEY,
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    if (laneId !== undefined && laneId !== '') {
        bus.send(message, laneId)
    } else {
        bus.send(message)
    }
}
