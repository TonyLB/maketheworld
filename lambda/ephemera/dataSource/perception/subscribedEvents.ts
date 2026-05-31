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
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import type { CharacterPerceptionRequestedCommand, PerceptionThreadRegisterCommand } from './localApiEvents'
import { RENDER_CACHE_DATA_SOURCE_KEY, type RenderCacheRenderPertainsPayload } from '../renderCache/baseClasses'
import {
    RENDER_ORCHESTRATION_DATA_SOURCE_KEY,
    type RenderOrchestrationGenerationDeferredPayload,
    type RenderOrchestrationGenerationStartedPayload,
    type RenderOrchestrationOrchestrationErrorPayload,
} from '../renderOrchestration/publishedEvents'

export type CharacterPerceptionIngressHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Character Perception Requested' }

export type CharacterPerceptionIngressEvent = {
    header: CharacterPerceptionIngressHeader;
    getContent: () => Promise<CharacterPerceptionRequestedCommand>;
}

const isCharacterPerceptionRequestedHeader: HeaderGuard<CharacterPerceptionIngressHeader> = (
    h
): h is CharacterPerceptionIngressHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Character Perception Requested'
)

export const isCharacterPerceptionRequestedIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterPerceptionRequestedCommand,
    CharacterPerceptionIngressHeader
>(isCharacterPerceptionRequestedHeader)

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
    | CharacterPerceptionRequestedCommand
    | PerceptionThreadRegisterCommand
    | RenderCacheRenderPertainsPayload
    | PerceptionFanInOrchestrationPayload

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

export const isPerceptionSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionSubscribedContent> => (
    isCharacterPerceptionRequestedIngressEnvelope(envelope)
        || isPerceptionThreadRegisteredIngressEnvelope(envelope)
        || isPerceptionRenderPertainsStreamEnvelope(envelope)
        || isPerceptionRoomDescriptionOrchestrationStreamEnvelope(envelope)
)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

/** streamKey should be the viewed character id (CHARACTER#...), i.e. command.ephemeraId. */
export function sendCharacterPerceptionRequested(
    bus: Bus,
    streamKey: string,
    content: CharacterPerceptionRequestedCommand
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Character Perception Requested',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

/**
 * streamKey should be componentId (ROOM# / FEATURE# / KNOWLEDGE#), matching render-style per-component keys.
 * Optional `laneId` scopes the message for `messageBus.flush(laneId)` ordering (e.g. event-driven look before render).
 */
export function sendPerceptionThreadRegistered(
    bus: Bus,
    streamKey: string,
    content: PerceptionThreadRegisterCommand,
    laneId?: string
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Perception Thread Registered',
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
    if (laneId !== undefined && laneId !== '') {
        bus.send(message, laneId)
    } else {
        bus.send(message)
    }
}
