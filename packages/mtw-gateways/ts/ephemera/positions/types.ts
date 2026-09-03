import type { EphemeraAreaId, EphemeraCharacterId, EphemeraFeatureId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId, EphemeraPositionAdjacencyContainedId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { StandardLudicGraphData } from '@tonylb/mtw-wml/ts/standardize/components/dataTypes/ludicGraph'

/**
 * The **authored** (WML) graph shape --- topology only, no `rootId` and no `ports`.
 *
 * Not the gateway's read or memo currency: that is `EphemeraLudicGraphFieldPayload`, the stored
 * Dynamo truth on `Meta::<Kind>.ludicGraph`. This alias survives for the consumers that genuinely
 * want the authored envelope (`EphemeraLudicGraph.toPlayEnvelope`, and the Exit-edge/prompt
 * readers downstream of it), where projecting down to it is the explicit ask rather than an
 * incidental cost of reading.
 * Mental model: lambda/ephemera/dataSource/positions/AGENT.concepts.md#graph-roles-shared-shape-different-authority
 */
export type PlayLudicGraph = StandardLudicGraphData

export type PositionsCacheSetParams = {
    componentId: EphemeraCharacterId | EphemeraRoomId | EphemeraObjectId | EphemeraFeatureId | EphemeraAreaId;
    graph: EphemeraLudicGraphFieldPayload;
}

export type MembershipContainersCacheSetParams = {
    componentId: EphemeraPositionAdjacencyContainedId;
    containers: EphemeraMembershipHostId[];
}
