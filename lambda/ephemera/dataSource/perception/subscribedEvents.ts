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
import type { CharacterPerceptionRequestedCommand } from './localApiEvents'

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

export type PerceptionSubscribedContent = CharacterPerceptionRequestedCommand

export const isPerceptionSubscribedEnvelope = (
    envelope: StreamingEventEnvelope<unknown>
): envelope is StreamingEventEnvelope<PerceptionSubscribedContent> => (
    isCharacterPerceptionRequestedIngressEnvelope(envelope)
)

type Bus = { send: (payload: StreamingEventMessage) => void }

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
