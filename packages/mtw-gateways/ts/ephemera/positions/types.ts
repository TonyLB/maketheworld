import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StandardPositionGraphData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/positionGraph'

/**
 * Gateway read envelope for play position graphs (Room or Character host).
 * Topology only: normalized to `StandardPositionGraphData`.
 * Dynamo manipulation truth: `EphemeraLudicGraphFieldPayload` on `Meta::Room.ludicGraph`.
 * Mental model: lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority
 */
export type PlayLudicGraph = StandardPositionGraphData

export type PositionsCacheSetParams = {
    componentId: EphemeraCharacterId | EphemeraRoomId;
    graph: PlayLudicGraph;
}

export type MembershipContainersCacheSetParams = {
    componentId: EphemeraPositionAdjacencyContainedId;
    containers: EphemeraMembershipHostId[];
}
