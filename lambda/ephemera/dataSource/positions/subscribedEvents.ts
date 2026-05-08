/**
 * `mtw.ephemera.positions` subscription surface: header/envelope guards for
 * external sources whose payloads describe a position change in play.
 *
 * The lane is intentionally general (positions in play); this slice's first
 * external ingress is `mtw.connections.characters` character presence.
 * Add new headers/guards here as additional position-affecting sources are
 * subscribed.
 */
import {
    StreamingEventHeader,
    HeaderGuard,
    makeStreamingEnvelopeGuardFromHeaderGuard
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import type {
    ConnectionsCharactersConnectedEvent,
    ConnectionsCharactersDisconnectedEvent,
    ConnectionsCharactersEventUpdate
} from '@tonylb/mtw-interfaces/ts/eventBridge/connections/characters'

export type EphemeraPositionsConnectionsCharactersHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' | 'Character Disconnected' }

export type EphemeraPositionsSubscribedHeader = EphemeraPositionsConnectionsCharactersHeader

export type EphemeraPositionsSubscribedContent = ConnectionsCharactersEventUpdate

export type EphemeraPositionsConnectionsCharactersEnvelope =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' }; getContent: () => Promise<ConnectionsCharactersConnectedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Disconnected' }; getContent: () => Promise<ConnectionsCharactersDisconnectedEvent> }

const isEphemeraPositionsConnectionsCharactersHeader: HeaderGuard<EphemeraPositionsConnectionsCharactersHeader> = (
    header
): header is EphemeraPositionsConnectionsCharactersHeader => (
    header.dataSourceKey === 'mtw.connections.characters' && (
        header.type === 'Character Connected' ||
        header.type === 'Character Disconnected'
    )
)

export const isEphemeraPositionsSubscribedHeader: HeaderGuard<EphemeraPositionsSubscribedHeader> = (
    header
): header is EphemeraPositionsSubscribedHeader =>
    isEphemeraPositionsConnectionsCharactersHeader(header)

export const isEphemeraPositionsConnectionsCharactersEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsCharactersEventUpdate,
    EphemeraPositionsConnectionsCharactersHeader
>(isEphemeraPositionsConnectionsCharactersHeader)

export const isEphemeraPositionsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraPositionsSubscribedContent,
    EphemeraPositionsSubscribedHeader
>(isEphemeraPositionsSubscribedHeader)
