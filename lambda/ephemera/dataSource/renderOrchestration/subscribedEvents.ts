/**
 * renderOrchestration ingress envelope guards and typed send-helpers.
 *
 * Transitional status:
 * - This is an ingress adapter only.
 * - Internal-only, non-replayable flow using dataSourceKey 'api.ephemera'.
 * - Do not treat this as a precedent for canonical DataSource publish semantics.
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
    RenderOrchestrationIngressCommand,
    RenderPreviewRequestedCommand,
    RenderRequestedCommand,
} from './localApiEvents'

export type RenderOrchestrationIngressHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' })
    | (StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Preview Requested' })

export type RenderOrchestrationIngressEvent =
    | {
        header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' };
        getContent: () => Promise<RenderRequestedCommand>;
    }
    | {
        header: StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Preview Requested' };
        getContent: () => Promise<RenderPreviewRequestedCommand>;
    }

const isRenderRequestedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' } => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Render Requested'
)

const isRenderPreviewRequestedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Preview Requested' }> = (
    h
): h is StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Preview Requested' } => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Render Preview Requested'
)

export const isRenderRequestedIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    RenderRequestedCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Requested' }
>(isRenderRequestedHeader)

export const isRenderPreviewRequestedIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    RenderPreviewRequestedCommand,
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Render Preview Requested' }
>(isRenderPreviewRequestedHeader)

export const isRenderOrchestrationIngressHeader: HeaderGuard<RenderOrchestrationIngressHeader> = (
    header
): header is RenderOrchestrationIngressHeader => (
    isRenderRequestedHeader(header) || isRenderPreviewRequestedHeader(header)
)

export const isRenderOrchestrationIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    RenderOrchestrationIngressCommand,
    RenderOrchestrationIngressHeader
>(isRenderOrchestrationIngressHeader)

type Bus = { send: (payload: StreamingEventMessage) => void }

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
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'api.ephemera',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}

export function sendRenderPreviewRequested(bus: Bus, streamKey: string, content: RenderPreviewRequestedCommand): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Render Preview Requested',
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
