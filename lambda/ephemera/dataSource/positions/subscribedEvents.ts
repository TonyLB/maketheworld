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
import type { CharacterNavigatePublishedPayload } from '../actions/publishedEvents'

export type EphemeraPositionsConnectionsCharactersHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' | 'Character Disconnected' }

export type EphemeraPositionsActionsCharacterNavigateHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Navigate' }

export type EphemeraPositionsSubscribedHeader =
    | EphemeraPositionsConnectionsCharactersHeader
    | EphemeraPositionsActionsCharacterNavigateHeader

export type EphemeraPositionsSubscribedContent =
    | ConnectionsCharactersEventUpdate
    | CharacterNavigatePublishedPayload

export type EphemeraPositionsConnectionsCharactersEnvelope =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' }; getContent: () => Promise<ConnectionsCharactersConnectedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Disconnected' }; getContent: () => Promise<ConnectionsCharactersDisconnectedEvent> }

export type EphemeraPositionsActionsCharacterNavigateEnvelope = {
    header: EphemeraPositionsActionsCharacterNavigateHeader;
    getContent: () => Promise<CharacterNavigatePublishedPayload>;
}

const isEphemeraPositionsActionsCharacterNavigateHeader: HeaderGuard<EphemeraPositionsActionsCharacterNavigateHeader> = (
    header
): header is EphemeraPositionsActionsCharacterNavigateHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Character Navigate'
)

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
    || isEphemeraPositionsActionsCharacterNavigateHeader(header)

export const isEphemeraPositionsConnectionsCharactersEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsCharactersEventUpdate,
    EphemeraPositionsConnectionsCharactersHeader
>(isEphemeraPositionsConnectionsCharactersHeader)

export const isEphemeraPositionsActionsCharacterNavigateEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterNavigatePublishedPayload,
    EphemeraPositionsActionsCharacterNavigateHeader
>(isEphemeraPositionsActionsCharacterNavigateHeader)

export const isEphemeraPositionsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraPositionsSubscribedContent,
    EphemeraPositionsSubscribedHeader
>(isEphemeraPositionsSubscribedHeader)
