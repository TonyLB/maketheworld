/**
 * The mover's relations, read from a cache's edges instead of its hosts' graphs (ISS8314). Planning
 * asks "what does moving this object sever, and what is at the other end?"; a joined crossing edge answers with its true
 * far end, and `endHosts` says which host's graph holds the leg at the mover's end. Pure over edges, so it is tested without a
 * store. The actor's cache exposes these through flat accessors (`actorCache.ts`); the cache's edges never leave it.
 *
 * What a cache cannot say is the far end of an **open leg** (a crossing whose other half no walk in this cache reached):
 * it says only "something hosted by that owner". Naming it is the one bounded graph read planning makes (`nameFarEnd`), which the caller owns.
 */
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraLudicCrossingPortAddress,
    isEphemeraLudicEdgeTerminal,
    type EphemeraLudicNodeTerminal,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { HostRelationalEdge } from '../ludicGraph'
import { moverRoleOnEdge, type TransferEndpointRole } from '../ludicGraph/expandValidate/interactionUnderTransfer'
import type { HostRelationalEdgeKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraLudicTerminalsEqual } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicCacheData, EphemeraLudicCacheEdge } from './types'

/** The other end of a boundary relation, as far as the cache can say. */
export type BoundaryFarEnd =
    | { kind: 'named'; id: EphemeraLudicNodeTerminal }
    | { kind: 'open'; owner: EphemeraMembershipHostId }

/**
 * One relation with the mover at exactly one end. `edge` is the cache edge as a plain graph edge (no `endHosts`), so a
 * challenge built from it stores the same shape one built from a graph edge does. `moverHost` is the host whose graph holds the
 * leg touching the mover, and `farHost` the one touching the far end.
 */
export type BoundaryRelation = {
    edge: HostRelationalEdge
    movedRole: TransferEndpointRole
    moverHost: EphemeraMembershipHostId
    /** The host whose graph holds the leg touching the far end (for an open leg, the same leg: the mover's host). */
    farHost: EphemeraMembershipHostId
    far: BoundaryFarEnd
}

/** A cache edge as the graph edge it was minted from: same terminals and identity, without `endHosts`. */
export const hostEdgeOfCacheEdge = (edge: EphemeraLudicCacheEdge): HostRelationalEdge => {
    const identity: { edgeId?: string; chainId?: string } = {
        ...(edge.edgeId !== undefined ? { edgeId: edge.edgeId } : {}),
        ...(edge.chainId !== undefined ? { chainId: edge.chainId } : {}),
    }
    return edge.kind === 'Custom'
        ? { ...identity, from: edge.from, to: edge.to, kind: 'Custom', relationLabel: edge.relationLabel }
        : { ...identity, from: edge.from, to: edge.to, kind: edge.kind }
}

const farEndOf = (terminal: EphemeraLudicCacheEdge['from']): BoundaryFarEnd | undefined => {
    if (typeof terminal === 'string') {
        return { kind: 'named', id: terminal }
    }
    if (isEphemeraLudicCrossingPortAddress(terminal)) {
        return { kind: 'open', owner: terminal.owner }
    }
    // A binding address or an edge terminal is no thing to name: planning has nothing to dissolve toward it.
    return undefined
}

/**
 * The edges that have `moverId` at exactly one end. `sourceHosts` limits them to legs held in the hosts the mover
 * leaves, as the graph read does (the legs in those hosts' graphs): a half-held rope taken from the table does not sever
 * what it holds in hand.
 */
export const boundaryRelationsOfEdges = (
    edges: readonly EphemeraLudicCacheEdge[],
    moverId: EphemeraObjectId,
    sourceHosts?: readonly EphemeraMembershipHostId[]
): BoundaryRelation[] => edges.flatMap((edge): BoundaryRelation[] => {
    const movedRole = moverRoleOnEdge(edge, moverId)
    if (movedRole === undefined) {
        return []
    }
    const moverHost = edge.endHosts[movedRole === 'subject' ? 'from' : 'to']
    const farHost = edge.endHosts[movedRole === 'subject' ? 'to' : 'from']
    const far = farEndOf(movedRole === 'subject' ? edge.to : edge.from)
    if (far === undefined || (sourceHosts !== undefined && !sourceHosts.includes(moverHost))) {
        return []
    }
    return [{ edge: hostEdgeOfCacheEdge(edge), movedRole, moverHost, farHost, far }]
})

/**
 * The `edgeId`s of the `Custom` edges that justify a `SecuredTo` (the manner half of a tie triple): the block covers
 * them, so they produce no facilitating dissolve of their own.
 */
export const securedToSupportEdgeIdsOfEdges = (edges: readonly EphemeraLudicCacheEdge[]): ReadonlySet<string> => {
    const securedIds = new Set(edges.flatMap((edge) => edge.kind === 'SecuredTo' && edge.edgeId !== undefined ? [edge.edgeId] : []))
    return new Set(edges.flatMap((edge) => (
        edge.kind === 'Justifies' && isEphemeraLudicEdgeTerminal(edge.from) && isEphemeraLudicEdgeTerminal(edge.to) && securedIds.has(edge.to.edgeId)
            ? [edge.from.edgeId]
            : []
    )))
}

/**
 * The bindings of `host` that hold a node: where `host`'s graph sees it (`presencesHolding` on the graph side), read from
 * `host`'s own bindings' covers. A room with no bindings of its own sees the node in the room itself, as a room's own graph
 * does; `undefined` for any other host, or a binding set holding nothing, reads "not learned".
 */
export const presencesOfNode = (
    cache: EphemeraLudicCacheData,
    nodeId: EphemeraLudicNodeTerminal,
    host: EphemeraMembershipHostId
): (EphemeraRoomId | { host: EphemeraMembershipHostId; presence: EphemeraPresenceNodeId })[] | undefined => {
    const bindings = cache.nodes.find(({ universalKey }) => universalKey === host)?.presenceNodes ?? []
    if (bindings.length === 0) {
        return isEphemeraRoomId(host) ? [host] : undefined
    }
    const holding = bindings
        .filter((binding) => binding.cover.members.some((member) => member.host === nodeId))
        .map((binding) => ({ host, presence: binding.universalKey }))
    return holding.length > 0 ? holding : undefined
}

/**
 * What the cache says about one named relation between two things (a dissolve's "what chain connects them?"):
 * `joined`, the edges with exactly these two ends (either direction), and `openLegs`, the unmatched legs of this
 * relation touching either end, whose far end only the bounded read can name. Kind and label must match.
 */
export type RelationsBetween = {
    joined: HostRelationalEdge[]
    openLegs: { hostId: EphemeraMembershipHostId; edge: HostRelationalEdge }[]
}

export const relationsBetweenEdges = (
    edges: readonly EphemeraLudicCacheEdge[],
    subjectId: EphemeraLudicNodeTerminal,
    targetId: EphemeraLudicNodeTerminal,
    relationKind: HostRelationalEdgeKind,
    relationLabel?: string
): RelationsBetween => {
    const matching = edges.filter((edge) => edge.kind === relationKind && (edge.kind !== 'Custom' || edge.relationLabel === relationLabel))
    const isEnd = (terminal: EphemeraLudicCacheEdge['from'], id: EphemeraLudicNodeTerminal) => ephemeraLudicTerminalsEqual(terminal, id)
    return {
        joined: matching
            .filter((edge) => (isEnd(edge.from, subjectId) && isEnd(edge.to, targetId)) || (isEnd(edge.from, targetId) && isEnd(edge.to, subjectId)))
            .map(hostEdgeOfCacheEdge),
        openLegs: matching.flatMap((edge) => {
            const [nodeSide, portEnd] = isEphemeraLudicCrossingPortAddress(edge.to) ? ['from', edge.to] as const
                : isEphemeraLudicCrossingPortAddress(edge.from) ? ['to', edge.from] as const : [undefined, undefined]
            if (nodeSide === undefined || portEnd === undefined) {
                return []
            }
            const node = edge[nodeSide]
            return isEnd(node, subjectId) || isEnd(node, targetId) ? [{ hostId: edge.endHosts[nodeSide], edge: hostEdgeOfCacheEdge(edge) }] : []
        }),
    }
}
