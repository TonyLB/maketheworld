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
import type { CharacterHomePublishedPayload, CharacterNavigatePublishedPayload, ObjectTakeHoldPublishedPayload } from '../actions/publishedEvents'
import type { DiagnosticsRoomOccupancyDriftFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

export type EphemeraPositionsConnectionsCharactersHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' | 'Character Disconnected' }

export type EphemeraPositionsActionsCharacterNavigateHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Navigate' }

export type EphemeraPositionsActionsCharacterHomeHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Home' }

export type EphemeraPositionsActionsObjectTakeHoldHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Object Take Hold' }

export type EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Room Occupancy Drift Finding' }

export type EphemeraPositionsSubscribedHeader =
    | EphemeraPositionsConnectionsCharactersHeader
    | EphemeraPositionsActionsCharacterNavigateHeader
    | EphemeraPositionsActionsCharacterHomeHeader
    | EphemeraPositionsActionsObjectTakeHoldHeader
    | EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader

export type EphemeraPositionsSubscribedContent =
    | ConnectionsCharactersEventUpdate
    | CharacterNavigatePublishedPayload
    | CharacterHomePublishedPayload
    | ObjectTakeHoldPublishedPayload
    | DiagnosticsRoomOccupancyDriftFindingEvent

export type EphemeraPositionsConnectionsCharactersEnvelope =
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' }; getContent: () => Promise<ConnectionsCharactersConnectedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Disconnected' }; getContent: () => Promise<ConnectionsCharactersDisconnectedEvent> }

export type EphemeraPositionsActionsCharacterNavigateEnvelope = {
    header: EphemeraPositionsActionsCharacterNavigateHeader;
    getContent: () => Promise<CharacterNavigatePublishedPayload>;
}

export type EphemeraPositionsActionsCharacterHomeEnvelope = {
    header: EphemeraPositionsActionsCharacterHomeHeader;
    getContent: () => Promise<CharacterHomePublishedPayload>;
}

export type EphemeraPositionsActionsObjectTakeHoldEnvelope = {
    header: EphemeraPositionsActionsObjectTakeHoldHeader;
    getContent: () => Promise<ObjectTakeHoldPublishedPayload>;
}

export type EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope = {
    header: EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader;
    getContent: () => Promise<DiagnosticsRoomOccupancyDriftFindingEvent>;
}

const isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader: HeaderGuard<EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader> = (
    header
): header is EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader => (
    header.dataSourceKey === 'mtw.diagnostics' && header.type === 'Room Occupancy Drift Finding'
)

const isEphemeraPositionsActionsCharacterNavigateHeader: HeaderGuard<EphemeraPositionsActionsCharacterNavigateHeader> = (
    header
): header is EphemeraPositionsActionsCharacterNavigateHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Character Navigate'
)

const isEphemeraPositionsActionsCharacterHomeHeader: HeaderGuard<EphemeraPositionsActionsCharacterHomeHeader> = (
    header
): header is EphemeraPositionsActionsCharacterHomeHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Character Home'
)

const isEphemeraPositionsActionsObjectTakeHoldHeader: HeaderGuard<EphemeraPositionsActionsObjectTakeHoldHeader> = (
    header
): header is EphemeraPositionsActionsObjectTakeHoldHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Object Take Hold'
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
    || isEphemeraPositionsActionsCharacterHomeHeader(header)
    || isEphemeraPositionsActionsObjectTakeHoldHeader(header)
    || isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader(header)

export const isEphemeraPositionsConnectionsCharactersEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ConnectionsCharactersEventUpdate,
    EphemeraPositionsConnectionsCharactersHeader
>(isEphemeraPositionsConnectionsCharactersHeader)

export const isEphemeraPositionsActionsCharacterNavigateEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterNavigatePublishedPayload,
    EphemeraPositionsActionsCharacterNavigateHeader
>(isEphemeraPositionsActionsCharacterNavigateHeader)

export const isEphemeraPositionsActionsCharacterHomeEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    CharacterHomePublishedPayload,
    EphemeraPositionsActionsCharacterHomeHeader
>(isEphemeraPositionsActionsCharacterHomeHeader)

export const isEphemeraPositionsActionsObjectTakeHoldEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectTakeHoldPublishedPayload,
    EphemeraPositionsActionsObjectTakeHoldHeader
>(isEphemeraPositionsActionsObjectTakeHoldHeader)

export const isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsRoomOccupancyDriftFindingEvent,
    EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader
>(isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader)

export const isEphemeraPositionsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraPositionsSubscribedContent,
    EphemeraPositionsSubscribedHeader
>(isEphemeraPositionsSubscribedHeader)
