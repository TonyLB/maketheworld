/**
 * renderOrchestration ingress envelope guards and typed send-helpers.
 *
 * Part of mtw.ephemera.renderOrchestration (see ../AGENT.md).
 * Internal-only publish path uses dataSourceKey 'api.ephemera'; stream outbounds are defined in publishedEvents.ts.
 * External ingress includes mtw.connections Character Registered (session orientation; handler Phase 3).
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../../messageBus/baseClasses'
import { isEphemeraStateStateChangedEnvelope } from '../state/events'
import type { StateChangedPayload } from '../state/events'
import type { LookCommandRequestedPublishedPayload } from '../actions/publishedEvents'
import type {
    RenderOrchestrationIngressCommand,
    RenderRequestedCommand,
} from './localApiEvents'
import {
    isConnectionsCharacterRegisteredEnvelope,
    type ConnectionsCharacterRegisteredSubscribedContent,
} from '../connectionsCharacterRegistered/subscribedEvents'

export type RenderOrchestrationIngressHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' }

export type RenderOrchestrationIngressEvent = {
    header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' };
    getContent: () => Promise<RenderRequestedCommand>;
}

const isRenderRequestedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' } => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Render Requested'
)

export const isRenderRequestedIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    RenderRequestedCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' }
>(isRenderRequestedHeader)

export const isRenderOrchestrationIngressHeader: HeaderGuard<RenderOrchestrationIngressHeader> = (
    header
): header is RenderOrchestrationIngressHeader => (
    isRenderRequestedHeader(header)
)

export const isRenderOrchestrationIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    RenderOrchestrationIngressCommand,
    RenderOrchestrationIngressHeader
>(isRenderOrchestrationIngressHeader)

const isLookCommandRequestedHeader: HeaderGuard<
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Look Command Requested' }
> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Look Command Requested' } => (
    h.dataSourceKey === 'mtw.ephemera.actions' && h.type === 'Look Command Requested'
)

export const isLookCommandRequestedActionsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    LookCommandRequestedPublishedPayload,
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Look Command Requested' }
>(isLookCommandRequestedHeader)

/** Ingress (`api.ephemera` render), `mtw.ephemera.actions` `Look Command Requested`, `State Changed` (passive fan-out), and `mtw.connections` `Character Registered`. */
export type RenderOrchestrationSubscribedContent =
    | RenderOrchestrationIngressCommand
    | StateChangedPayload
    | LookCommandRequestedPublishedPayload
    | ConnectionsCharacterRegisteredSubscribedContent

export const isRenderOrchestrationSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<RenderOrchestrationSubscribedContent> => (
    isRenderOrchestrationIngressEnvelope(envelope)
    || isEphemeraStateStateChangedEnvelope(envelope)
    || isLookCommandRequestedActionsEnvelope(envelope)
    || isConnectionsCharacterRegisteredEnvelope(envelope)
)

type Bus = { send: (payload: StreamingEventMessage, laneId?: string) => void }

/** Stable message-bus lane for a render-orchestration work unit; matches ingress {@link sendRenderRequested}. */
export function renderOrchestrationIngressLaneId(streamKey: string): string {
    return `renderOrchestration:${streamKey}`
}

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

export type SendRenderRequestedOptions = {
    /**
     * When set, the message is on the default bus lane so an in-flight `flush` picks it up (e.g. event-driven look after flushing its run-scoped perception lane). Otherwise uses {@link renderOrchestrationIngressLaneId}.
     */
    useDefaultMessageBusLane?: boolean
}

export function sendRenderRequested(
    bus: Bus,
    streamKey: string,
    content: RenderRequestedCommand,
    options?: SendRenderRequestedOptions
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Render Requested',
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
            renderOrchestrationIngressLaneId(streamKey),
        )
    }
}
