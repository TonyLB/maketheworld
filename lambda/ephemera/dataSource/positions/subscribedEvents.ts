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
import type { CharacterHomePublishedPayload, CharacterNavigatePublishedPayload, LudicNetworkChangeRequestedPublishedPayload, ObjectContainmentPublishedPayload } from '../actions/publishedEvents'
import type { DiagnosticsLudicGraphPortMismatchFindingEvent, DiagnosticsLudicGraphStaleStructureFindingEvent, DiagnosticsRoomOccupancyDriftFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

export type EphemeraPositionsConnectionsCharactersHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' | 'Character Disconnected' }

export type EphemeraPositionsActionsCharacterNavigateHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Navigate' }

export type EphemeraPositionsActionsCharacterHomeHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Home' }

export type EphemeraPositionsActionsObjectContainmentHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Object Containment' }

/** AP-9 (slice 3a): the generalized hand-off for membership/relational attempts, replacing
 * `Object Take Hold`/`Object Drop`/`Object Establish Relation`/`Object Dissolve Relation`
 * (retired 3a-iv). `Object Containment` stays separate until containment joins it (slice 3c). */
export type EphemeraPositionsActionsLudicNetworkChangeRequestedHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Ludic Network Change Requested' }

export type EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Room Occupancy Drift Finding' }

export type EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ludic Graph Stale Structure Finding' }

export type EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.diagnostics'; type: 'Ludic Graph Port Mismatch Finding' }

export type EphemeraPositionsSubscribedHeader =
    | EphemeraPositionsConnectionsCharactersHeader
    | EphemeraPositionsActionsCharacterNavigateHeader
    | EphemeraPositionsActionsCharacterHomeHeader
    | EphemeraPositionsActionsObjectContainmentHeader
    | EphemeraPositionsActionsLudicNetworkChangeRequestedHeader
    | EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader
    | EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader
    | EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader

export type EphemeraPositionsSubscribedContent =
    | ConnectionsCharactersEventUpdate
    | CharacterNavigatePublishedPayload
    | CharacterHomePublishedPayload
    | ObjectContainmentPublishedPayload
    | LudicNetworkChangeRequestedPublishedPayload
    | DiagnosticsRoomOccupancyDriftFindingEvent
    | DiagnosticsLudicGraphStaleStructureFindingEvent
    | DiagnosticsLudicGraphPortMismatchFindingEvent

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

export type EphemeraPositionsActionsObjectContainmentEnvelope = {
    header: EphemeraPositionsActionsObjectContainmentHeader;
    getContent: () => Promise<ObjectContainmentPublishedPayload>;
}

export type EphemeraPositionsActionsLudicNetworkChangeRequestedEnvelope = {
    header: EphemeraPositionsActionsLudicNetworkChangeRequestedHeader;
    getContent: () => Promise<LudicNetworkChangeRequestedPublishedPayload>;
}

export type EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope = {
    header: EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader;
    getContent: () => Promise<DiagnosticsRoomOccupancyDriftFindingEvent>;
}

export type EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope = {
    header: EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader;
    getContent: () => Promise<DiagnosticsLudicGraphStaleStructureFindingEvent>;
}

export type EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingEnvelope = {
    header: EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader;
    getContent: () => Promise<DiagnosticsLudicGraphPortMismatchFindingEvent>;
}

const isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader: HeaderGuard<EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader> = (
    header
): header is EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader => (
    header.dataSourceKey === 'mtw.diagnostics' && header.type === 'Room Occupancy Drift Finding'
)

const isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader: HeaderGuard<EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader> = (
    header
): header is EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader => (
    header.dataSourceKey === 'mtw.diagnostics' && header.type === 'Ludic Graph Stale Structure Finding'
)

const isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader: HeaderGuard<EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader> = (
    header
): header is EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader => (
    header.dataSourceKey === 'mtw.diagnostics' && header.type === 'Ludic Graph Port Mismatch Finding'
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

const isEphemeraPositionsActionsObjectContainmentHeader: HeaderGuard<EphemeraPositionsActionsObjectContainmentHeader> = (
    header
): header is EphemeraPositionsActionsObjectContainmentHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Object Containment'
)

const isEphemeraPositionsActionsLudicNetworkChangeRequestedHeader: HeaderGuard<EphemeraPositionsActionsLudicNetworkChangeRequestedHeader> = (
    header
): header is EphemeraPositionsActionsLudicNetworkChangeRequestedHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Ludic Network Change Requested'
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
    || isEphemeraPositionsActionsObjectContainmentHeader(header)
    || isEphemeraPositionsActionsLudicNetworkChangeRequestedHeader(header)
    || isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader(header)
    || isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader(header)
    || isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader(header)

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

export const isEphemeraPositionsActionsObjectContainmentEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectContainmentPublishedPayload,
    EphemeraPositionsActionsObjectContainmentHeader
>(isEphemeraPositionsActionsObjectContainmentHeader)

export const isEphemeraPositionsActionsLudicNetworkChangeRequestedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    LudicNetworkChangeRequestedPublishedPayload,
    EphemeraPositionsActionsLudicNetworkChangeRequestedHeader
>(isEphemeraPositionsActionsLudicNetworkChangeRequestedHeader)

export const isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsRoomOccupancyDriftFindingEvent,
    EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader
>(isEphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader)

export const isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsLudicGraphStaleStructureFindingEvent,
    EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader
>(isEphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader)

export const isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    DiagnosticsLudicGraphPortMismatchFindingEvent,
    EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader
>(isEphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader)

export const isEphemeraPositionsSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    EphemeraPositionsSubscribedContent,
    EphemeraPositionsSubscribedHeader
>(isEphemeraPositionsSubscribedHeader)
