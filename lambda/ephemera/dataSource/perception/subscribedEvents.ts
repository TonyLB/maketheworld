/**
 * Ingress envelope guards and typed send-helpers for mtw.ephemera.perception.
 *
 * Invoked ingress uses dataSourceKey 'api.ephemera' (see ../AGENT.md).
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus, StreamingEventMessage } from '../../messageBus/baseClasses'
import type { PerceptionThreadRegisterCommand } from './localApiEvents'
import { RENDER_CACHE_DATA_SOURCE_KEY, type RenderCacheRenderPertainsPayload } from '../renderCache/baseClasses'
import {
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
    type RenderOrchestrationGenerationDeferredPayload,
    type RenderOrchestrationGenerationStartedPayload,
    type RenderOrchestrationOrchestrationErrorPayload,
} from '../renderOrchestration/publishedEvents'
import {
    AFFORDANCE_CACHE_DATA_SOURCE_KEY,
    type AffordancesPertainPayload,
} from '../affordanceCache/publishedEvents'

export type PerceptionThreadRegisteredIngressHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Perception Thread Registered' }

const isPerceptionThreadRegisteredHeader: HeaderGuard<PerceptionThreadRegisteredIngressHeader> = (
    h
): h is PerceptionThreadRegisteredIngressHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Perception Thread Registered'
)

export const isPerceptionThreadRegisteredIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    PerceptionThreadRegisterCommand,
    PerceptionThreadRegisteredIngressHeader
>(isPerceptionThreadRegisteredHeader)

export type PerceptionFanInOrchestrationPayload =
    | RenderOrchestrationGenerationStartedPayload
    | RenderOrchestrationOrchestrationErrorPayload
    | RenderOrchestrationGenerationDeferredPayload

const PERCEPTION_FAN_IN_ORCHESTRATION_HEADER_TYPES = [
    'Generation Started',
    'Orchestration Error',
    'Generation Deferred',
] as const

export type PerceptionSubscribedContent =
    | PerceptionThreadRegisterCommand
    | RenderCacheRenderPertainsPayload
    | PerceptionFanInOrchestrationPayload
    | AffordancesPertainPayload

export const isPerceptionRenderPertainsStreamEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<RenderCacheRenderPertainsPayload> => (
    envelope.header.dataSourceKey === RENDER_CACHE_DATA_SOURCE_KEY
    && envelope.header.type === 'Render Pertains'
)

export const isPerceptionRoomDescriptionOrchestrationStreamEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionFanInOrchestrationPayload> => (
    envelope.header.dataSourceKey === RENDER_ORCHESTRATION_DATA_SOURCE_KEY
    && (PERCEPTION_FAN_IN_ORCHESTRATION_HEADER_TYPES as readonly string[]).includes(envelope.header.type)
)

export const isPerceptionAffordancesPertainStreamEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<AffordancesPertainPayload> => (
    envelope.header.dataSourceKey === AFFORDANCE_CACHE_DATA_SOURCE_KEY
    && envelope.header.type === 'Affordances Pertain'
)

export const isPerceptionSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionSubscribedContent> => (
    isPerceptionThreadRegisteredIngressEnvelope(envelope)
        || isPerceptionRenderPertainsStreamEnvelope(envelope)
        || isPerceptionRoomDescriptionOrchestrationStreamEnvelope(envelope)
        || isPerceptionAffordancesPertainStreamEnvelope(envelope)
        // No position-change subscriptions: object moves and relational dissolves narrate through
        // the attempt's narration units, delivered by positions' post-commit sweep
        // (`deliverNarrationUnits.ts`), and character moves through the mutation kernel, so
        // perception has no reason to see `Ludic Network Change Requested` or
        // `Object Relation Changed`.
)

type PublishBus = Pick<MessageBus, 'publish'>

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

/**
 * streamKey should be componentId (ROOM# / FEATURE# / KNOWLEDGE#), matching render-style per-component keys.
 * External kicks only; same-DataSource handoffs register via `internalCache.PerceptionThreads.register` directly.
 */
export function sendPerceptionThreadRegistered(
    bus: PublishBus,
    streamKey: string,
    content: PerceptionThreadRegisterCommand,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Perception Thread Registered',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    bus.publish(message)
}
