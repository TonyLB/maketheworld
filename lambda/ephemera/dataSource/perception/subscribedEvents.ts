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
import type { CharacterPerceptionRequestedCommand, PerceptionThreadRegisterCommand } from './localApiEvents'
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
import type { CharacterHomePublishedPayload } from '../actions/publishedEvents'
import type { CharacterNavigatePublishedPayload, ObjectDropPublishedPayload, ObjectTakeHoldPublishedPayload } from '../actions/publishedEvents'
import type { ConnectionsCharactersEventUpdate } from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'
import type { CharacterMovedPublishedPayload, ObjectMovedPublishedPayload } from '../positions/publishedEvents'
import {
    isPerceptionActionsCharacterHomeEnvelope,
    isPerceptionActionsCharacterNavigateEnvelope,
    isPerceptionConnectionsCharactersEnvelope,
    isPerceptionPositionsCharacterMovedEnvelope,
    toMembershipPresentationLeg,
} from './membershipPresentationLegAdapters'
import {
    isPerceptionActionsObjectDropEnvelope,
    isPerceptionActionsObjectTakeHoldEnvelope,
    isPerceptionPositionsObjectMovedEnvelope,
    toObjectManipulationPresentationLeg,
} from './objectManipulationPresentationLegAdapters'

export {
    isPerceptionActionsCharacterHomeEnvelope,
    isPerceptionActionsCharacterNavigateEnvelope,
    isPerceptionConnectionsCharactersEnvelope,
    isPerceptionPositionsCharacterMovedEnvelope,
    toMembershipPresentationLeg,
} from './membershipPresentationLegAdapters'

export {
    isPerceptionActionsObjectDropEnvelope,
    isPerceptionActionsObjectTakeHoldEnvelope,
    isPerceptionPositionsObjectMovedEnvelope,
    toObjectManipulationPresentationLeg,
} from './objectManipulationPresentationLegAdapters'

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
    | AffordancesPertainPayload
    | CharacterNavigatePublishedPayload
    | CharacterHomePublishedPayload
    | ConnectionsCharactersEventUpdate
    | CharacterMovedPublishedPayload
    | ObjectTakeHoldPublishedPayload
    | ObjectDropPublishedPayload
    | ObjectMovedPublishedPayload

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
    isCharacterPerceptionRequestedIngressEnvelope(envelope)
        || isPerceptionThreadRegisteredIngressEnvelope(envelope)
        || isPerceptionRenderPertainsStreamEnvelope(envelope)
        || isPerceptionRoomDescriptionOrchestrationStreamEnvelope(envelope)
        || isPerceptionAffordancesPertainStreamEnvelope(envelope)
        || isPerceptionActionsCharacterNavigateEnvelope(envelope)
        || isPerceptionActionsCharacterHomeEnvelope(envelope)
        || isPerceptionConnectionsCharactersEnvelope(envelope)
        || isPerceptionPositionsCharacterMovedEnvelope(envelope)
        || isPerceptionActionsObjectTakeHoldEnvelope(envelope)
        || isPerceptionActionsObjectDropEnvelope(envelope)
        || isPerceptionPositionsObjectMovedEnvelope(envelope)
)

type PublishBus = Pick<MessageBus, 'publish'>

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

/** streamKey should be the viewed character id (CHARACTER#...), i.e. command.ephemeraId. */
export function sendCharacterPerceptionRequested(
    bus: PublishBus,
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
    bus.publish({
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
