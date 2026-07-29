/**
 * Ingress envelope guards and typed send-helpers for mtw.ephemera.messageOrchestration.
 *
 * Invoked ingress uses dataSourceKey 'api.ephemera' (see ./AGENT.md). No caller wires the
 * send-helpers yet --- Phase 3 (navigate) and Phase 5 (object-look kernel) do that.
 */
import {
    StreamingEventEnvelope,
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus, StreamingEventMessage } from '../../messageBus/baseClasses'
import type { MessageBundleDeclareCommand, MessageSlotReportCommand } from './localApiEvents'

export type MessageBundleDeclaredIngressHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Message Bundle Declared' }

const isMessageBundleDeclaredHeader: HeaderGuard<MessageBundleDeclaredIngressHeader> = (
    h
): h is MessageBundleDeclaredIngressHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Message Bundle Declared'
)

export const isMessageBundleDeclaredIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    MessageBundleDeclareCommand,
    MessageBundleDeclaredIngressHeader
>(isMessageBundleDeclaredHeader)

export type MessageSlotReportedIngressHeader =
    StreamingEventHeader & { dataSourceKey: 'api.ephemera'; type: 'Message Slot Reported' }

const isMessageSlotReportedHeader: HeaderGuard<MessageSlotReportedIngressHeader> = (
    h
): h is MessageSlotReportedIngressHeader => (
    h.dataSourceKey === 'api.ephemera' && h.type === 'Message Slot Reported'
)

export const isMessageSlotReportedIngressEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    MessageSlotReportCommand,
    MessageSlotReportedIngressHeader
>(isMessageSlotReportedHeader)

export type MessageOrchestrationSubscribedContent = MessageBundleDeclareCommand | MessageSlotReportCommand

export const isMessageOrchestrationSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<MessageOrchestrationSubscribedContent> => (
    isMessageBundleDeclaredIngressEnvelope(envelope) || isMessageSlotReportedIngressEnvelope(envelope)
)

type PublishBus = Pick<MessageBus, 'publish'>

const apiEphemeraSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

/** streamKey should be the bundleId. */
export function sendMessageBundleDeclared(
    bus: PublishBus,
    streamKey: string,
    content: MessageBundleDeclareCommand
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Message Bundle Declared',
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

/** streamKey should be the bundleId. */
export function sendMessageSlotReported(
    bus: PublishBus,
    streamKey: string,
    content: MessageSlotReportCommand
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.ephemera',
        streamKey,
        timestamp,
        type: 'Message Slot Reported',
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
