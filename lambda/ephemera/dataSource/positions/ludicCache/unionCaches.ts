/**
 * The one composition rule (rules: `positions/AGENT.contract.md`, "Cache edges keep unmatched crossing legs"). `buildLudicCache` derives a small
 * `EphemeraLudicCacheData` from each host's `ludicGraph` and reduces them through this union; the actor's cache
 * combines the room's stored row with the actor's fold through the same function.
 *
 * Nodes are keyed by `universalKey` (a later cache's node wins a collision, and keeps its first position).
 * Edges are concatenated, then run once through the leg-matching rule (`joinCrossingLegs`: two distinct legs naming
 * one crossing-port address become the one joined edge), then an open leg already covered by a joined edge is dropped
 * (`isHalfOf`), then deduped by identity. Matching all the legs at once, not
 * pairwise, keeps the result independent of how the reduction is shaped.
 */
import { ephemeraLudicTerminalsEqual, isEphemeraLudicCrossingPortAddress, type EphemeraLudicCrossingPortAddress } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { toStoredRelationalEdge } from '../ludicGraph'
import { dedupeEdgesByIdentity, joinCrossingLegs } from './mergeReducer'
import type { EphemeraLudicCacheData, EphemeraLudicCacheEdge, EphemeraLudicCacheTerminalId } from './types'

const hasCrossingPort = (edge: EphemeraLudicCacheEdge): boolean =>
    isEphemeraLudicCrossingPortAddress(edge.from) || isEphemeraLudicCrossingPortAddress(edge.to)

/**
 * Whether `joined` is the edge `leg` is half of: one relationship (`edgeId`, which legs of one edge share by
 * `legsAgree`), with the leg's non-port terminal on the same side. A union cannot otherwise tell a leg whose partner is
 * outside it from a leg whose pair another half already joined (the room row joins a crossing that the actor's fold,
 * which walks only the child, sees as one open leg). Without an `edgeId` the match is not provable, so the leg stays.
 */
const isHalfOf = (leg: EphemeraLudicCacheEdge, joined: EphemeraLudicCacheEdge): boolean => {
    if (leg.edgeId === undefined || joined.edgeId !== leg.edgeId || joined.kind !== leg.kind || joined.chainId !== leg.chainId) {
        return false
    }
    if (leg.kind === 'Custom' && joined.kind === 'Custom' && leg.relationLabel !== joined.relationLabel) {
        return false
    }
    const portOnFrom = isEphemeraLudicCrossingPortAddress(leg.from)
    return ephemeraLudicTerminalsEqual(portOnFrom ? leg.to : leg.from, portOnFrom ? joined.to : joined.from)
}

/** The joined edge's port end now sits where the partner leg's outer end sat (`endHosts` records each outer leg's host). */
const joinEndHosts = (
    joined: EphemeraLudicCacheEdge,
    first: EphemeraLudicCacheEdge,
    second: EphemeraLudicCacheEdge,
    address: EphemeraLudicCrossingPortAddress
): EphemeraLudicCacheEdge => {
    const firstPortSide = ephemeraLudicTerminalsEqual(first.from, address) ? 'from' : 'to'
    const secondOuterSide = ephemeraLudicTerminalsEqual(second.from, address) ? 'to' : 'from'
    return { ...joined, endHosts: { ...first.endHosts, [firstPortSide]: second.endHosts[secondOuterSide] } }
}

const joinCacheEdges = (edges: EphemeraLudicCacheEdge[]): EphemeraLudicCacheEdge[] => {
    const { edges: joined } = joinCrossingLegs<EphemeraLudicCacheTerminalId, EphemeraLudicCacheEdge>(edges, joinEndHosts)
    const stored = joined.map((edge): EphemeraLudicCacheEdge => ({ ...toStoredRelationalEdge<EphemeraLudicCacheTerminalId>(edge), endHosts: edge.endHosts }))
    const settled = stored.filter((edge) => !hasCrossingPort(edge))
    return dedupeEdgesByIdentity(stored.filter((edge) => !hasCrossingPort(edge) || !settled.some((other) => isHalfOf(edge, other))))
}

export const unionAllLudicCaches = (hostId: EphemeraMembershipHostId, caches: EphemeraLudicCacheData[]): EphemeraLudicCacheData => ({
    hostId,
    nodes: [...new Map(caches.flatMap(({ nodes }) => nodes).map((node) => [node.universalKey, node])).values()],
    edges: joinCacheEdges(caches.flatMap(({ edges }) => edges)),
})

/** The room's cache and the actor's, as one. */
export const unionLudicCaches = (room: EphemeraLudicCacheData, actor: EphemeraLudicCacheData): EphemeraLudicCacheData =>
    unionAllLudicCaches(actor.hostId, [room, actor])
