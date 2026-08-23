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
import type { CharacterHomePublishedPayload, CharacterNavigatePublishedPayload, ObjectDissolveRelationPublishedPayload, ObjectDropPublishedPayload, ObjectEstablishRelationPublishedPayload, ObjectTakeHoldPublishedPayload } from '../actions/publishedEvents'
import type { DiagnosticsLudicGraphPortMismatchFindingEvent, DiagnosticsLudicGraphStaleStructureFindingEvent, DiagnosticsRoomOccupancyDriftFindingEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/diagnostics'

export type EphemeraPositionsConnectionsCharactersHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.connections.characters'; type: 'Character Connected' | 'Character Disconnected' }

export type EphemeraPositionsActionsCharacterNavigateHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Navigate' }

export type EphemeraPositionsActionsCharacterHomeHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Character Home' }

export type EphemeraPositionsActionsObjectTakeHoldHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Object Take Hold' }

export type EphemeraPositionsActionsObjectDropHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Object Drop' }

export type EphemeraPositionsActionsObjectEstablishRelationHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Object Establish Relation' }

export type EphemeraPositionsActionsObjectDissolveRelationHeader =
    StreamingEventHeader & { dataSourceKey: 'mtw.ephemera.actions'; type: 'Object Dissolve Relation' }

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
    | EphemeraPositionsActionsObjectTakeHoldHeader
    | EphemeraPositionsActionsObjectDropHeader
    | EphemeraPositionsActionsObjectEstablishRelationHeader
    | EphemeraPositionsActionsObjectDissolveRelationHeader
    | EphemeraPositionsDiagnosticsRoomOccupancyDriftFindingHeader
    | EphemeraPositionsDiagnosticsLudicGraphStaleStructureFindingHeader
    | EphemeraPositionsDiagnosticsLudicGraphPortMismatchFindingHeader

export type EphemeraPositionsSubscribedContent =
    | ConnectionsCharactersEventUpdate
    | CharacterNavigatePublishedPayload
    | CharacterHomePublishedPayload
    | ObjectTakeHoldPublishedPayload
    | ObjectDropPublishedPayload
    | ObjectEstablishRelationPublishedPayload
    | ObjectDissolveRelationPublishedPayload
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

export type EphemeraPositionsActionsObjectTakeHoldEnvelope = {
    header: EphemeraPositionsActionsObjectTakeHoldHeader;
    getContent: () => Promise<ObjectTakeHoldPublishedPayload>;
}

export type EphemeraPositionsActionsObjectDropEnvelope = {
    header: EphemeraPositionsActionsObjectDropHeader;
    getContent: () => Promise<ObjectDropPublishedPayload>;
}

export type EphemeraPositionsActionsObjectEstablishRelationEnvelope = {
    header: EphemeraPositionsActionsObjectEstablishRelationHeader;
    getContent: () => Promise<ObjectEstablishRelationPublishedPayload>;
}

export type EphemeraPositionsActionsObjectDissolveRelationEnvelope = {
    header: EphemeraPositionsActionsObjectDissolveRelationHeader;
    getContent: () => Promise<ObjectDissolveRelationPublishedPayload>;
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

const isEphemeraPositionsActionsObjectTakeHoldHeader: HeaderGuard<EphemeraPositionsActionsObjectTakeHoldHeader> = (
    header
): header is EphemeraPositionsActionsObjectTakeHoldHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Object Take Hold'
)

const isEphemeraPositionsActionsObjectDropHeader: HeaderGuard<EphemeraPositionsActionsObjectDropHeader> = (
    header
): header is EphemeraPositionsActionsObjectDropHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Object Drop'
)

const isEphemeraPositionsActionsObjectEstablishRelationHeader: HeaderGuard<EphemeraPositionsActionsObjectEstablishRelationHeader> = (
    header
): header is EphemeraPositionsActionsObjectEstablishRelationHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Object Establish Relation'
)

const isEphemeraPositionsActionsObjectDissolveRelationHeader: HeaderGuard<EphemeraPositionsActionsObjectDissolveRelationHeader> = (
    header
): header is EphemeraPositionsActionsObjectDissolveRelationHeader => (
    header.dataSourceKey === 'mtw.ephemera.actions' && header.type === 'Object Dissolve Relation'
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
    || isEphemeraPositionsActionsObjectDropHeader(header)
    || isEphemeraPositionsActionsObjectEstablishRelationHeader(header)
    || isEphemeraPositionsActionsObjectDissolveRelationHeader(header)
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

export const isEphemeraPositionsActionsObjectTakeHoldEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectTakeHoldPublishedPayload,
    EphemeraPositionsActionsObjectTakeHoldHeader
>(isEphemeraPositionsActionsObjectTakeHoldHeader)

export const isEphemeraPositionsActionsObjectDropEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectDropPublishedPayload,
    EphemeraPositionsActionsObjectDropHeader
>(isEphemeraPositionsActionsObjectDropHeader)

export const isEphemeraPositionsActionsObjectEstablishRelationEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectEstablishRelationPublishedPayload,
    EphemeraPositionsActionsObjectEstablishRelationHeader
>(isEphemeraPositionsActionsObjectEstablishRelationHeader)

export const isEphemeraPositionsActionsObjectDissolveRelationEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    ObjectDissolveRelationPublishedPayload,
    EphemeraPositionsActionsObjectDissolveRelationHeader
>(isEphemeraPositionsActionsObjectDissolveRelationHeader)

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
