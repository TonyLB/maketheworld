import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StandardLudicGraphData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/ludicGraph'

/**
 * Gateway read envelope for play ludic graphs (Room, Character, or Object host).
 * Topology only: normalized to `StandardLudicGraphData`.
 * Dynamo manipulation truth: `EphemeraLudicGraphFieldPayload` on `Meta::Room.ludicGraph`.
 * Mental model: lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority
 */
export type PlayLudicGraph = StandardLudicGraphData

export type PositionsCacheSetParams = {
    componentId: EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId;
    graph: PlayLudicGraph;
}

export type MembershipContainersCacheSetParams = {
    componentId: EphemeraPositionAdjacencyContainedId;
    containers: EphemeraMembershipHostId[];
}
