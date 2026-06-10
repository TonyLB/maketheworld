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
import type { MessageBus, StreamingEventMessage } from '../../messageBus/baseClasses'
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

type PublishBus = Pick<MessageBus, 'publish'>

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

/**
 * External / cross-module kick: publish `api.ephemera` `Render Requested` for renderOrchestration ingress.
 * Same-DataSource handoffs (look, session orientation) call {@link orchestrateRenderRequest} directly.
 */
export function sendRenderRequested(
    bus: PublishBus,
    streamKey: string,
    content: RenderRequestedCommand,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Render Requested',
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
