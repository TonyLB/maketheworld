import type { EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { StandardPositionGraphData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/positionGraph'

/** Roster projection entry for affordance wire compose (presentation layer; not Dynamo membership truth). */
export type PlayPositionRoomRosterEntry = {
    EphemeraId: EphemeraCharacterId;
    DisplayName: string;
    SessionIds: string[];
    Color?: LegalCharacterColor;
    fileURL?: string;
}

/**
 * Gateway read envelope for play position graphs (Room or Character host).
 * Topology only: normalized to `StandardPositionGraphData`.
 * Dynamo manipulation truth: `EphemeraPlayPositionGraph` on `Meta::Room.positionGraph`.
 * Mental model: lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority
 */
export type PlayPositionGraph = StandardPositionGraphData

export type PositionsCacheSetParams = {
    componentId: EphemeraCharacterId | EphemeraRoomId;
    graph: PlayPositionGraph;
}

export type MembershipContainersCacheSetParams = {
    componentId: EphemeraCharacterId;
    containers: EphemeraRoomId[];
}
