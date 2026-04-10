/**
 * renderOrchestration ingress envelope guards and typed send-helpers.
 *
 * Part of mtw.ephemera.renderOrchestration (see ../AGENT.md).
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
import { isEphemeraStateStateChangedEnvelope } from '../state/events'
import type { StateChangedPayload } from '../state/events'
import type {
    RenderOrchestrationIngressCommand,
    RenderRequestedCommand,
} from './localApiEvents'

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

/** Ingress (`api.ephemera` render commands) plus `mtw.ephemera.state` `State Changed` (passive fan-out). */
export type RenderOrchestrationSubscribedContent = RenderOrchestrationIngressCommand | StateChangedPayload

export const isRenderOrchestrationSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<RenderOrchestrationSubscribedContent> => (
    isRenderOrchestrationIngressEnvelope(envelope) || isEphemeraStateStateChangedEnvelope(envelope)
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

export function sendRenderRequested(bus: Bus, streamKey: string, content: RenderRequestedCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Render Requested',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiEphemeraSerializer)
    bus.send(
        {
            type: 'StreamingEvent',
            dataSourceKey: 'api.ephemera',
            streamKey,
            header: envelope.header,
            getContent: envelope.getContent,
            timestamp,
        },
        renderOrchestrationIngressLaneId(streamKey),
    )
}
