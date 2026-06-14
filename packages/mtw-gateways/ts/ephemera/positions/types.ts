import type { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardPositionGraphData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/positionGraph'

/** Roster projection entry derived from play position graph (slice 1 flat-field adapter). */
export type PlayPositionRoomRosterEntry = {
    EphemeraId: EphemeraCharacterId;
    DisplayName: string;
    SessionIds: string[];
    Color?: LegalCharacterColor;
    fileURL?: string;
}

/**
 * Play position graph for a Room or Character component.
 * Slice 1: projected from flat `activeCharacters` / `RoomId`; slice 2 swaps backing read.
 */
export type PlayPositionGraph = StandardPositionGraphData & {
    /** Slice 1 roster metadata keyed by character EphemeraId (room graphs). */
    characterRosterMeta?: Partial<Record<EphemeraCharacterId, PlayPositionRoomRosterEntry>>;
    /** Character endpoint: current room membership (null = out of play). */
    roomEndpoint?: EphemeraRoomId | null;
}

export type PositionsCacheSetParams = {
    componentId: EphemeraCharacterId | EphemeraRoomId;
    graph: PlayPositionGraph;
}

export type MembershipContainersCacheSetParams = {
    componentId: EphemeraCharacterId;
    containers: EphemeraRoomId[];
}
