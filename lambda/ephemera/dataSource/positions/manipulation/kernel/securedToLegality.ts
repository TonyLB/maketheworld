import { ephemeraLudicTerminalKey, isEphemeraLudicBindingAddress, isEphemeraLudicCrossingPortAddress, isEphemeraLudicEdgeTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'

/**
 * Why `terminal` cannot be an endpoint of a `SecuredTo` edge in `hostId`'s graph, or undefined if it
 * can. `SecuredTo` is same-graph and single-leg: an endpoint is a plain node of this graph, either a
 * member (a node with a hosting kind) or the host's own root. An edge, a binding address, a crossing
 * port or a presence node is not a thing that can be secured.
 */
const endpointViolation = (graph: EphemeraLudicGraph, hostId: EphemeraMembershipHostId, terminal: EphemeraLudicTerminalId): string | undefined => {
    if (isEphemeraLudicEdgeTerminal(terminal)) {
        return `${ephemeraLudicTerminalKey(terminal)} is an edge: only Justifies carries an edge terminal`
    }
    if (isEphemeraLudicBindingAddress(terminal) || isEphemeraLudicCrossingPortAddress(terminal) || isEphemeraPresenceNodeId(terminal)) {
        return `${ephemeraLudicTerminalKey(terminal)} is not a node of ${hostId}: SecuredTo joins two things of one graph`
    }
    return terminal === hostId || graph.hostingKindOf(terminal) !== undefined
        ? undefined
        : `${terminal} is not in ${hostId}'s graph: a crossing SecuredTo is not supported`
}

/**
 * The legality rule for establishing a `SecuredTo` edge in `hostId`'s graph: both endpoints are nodes
 * of that graph (members, or the host's own root). A violation means a producer wrote the wrong
 * shape, so the kernel throws rather than returning a verdict.
 */
export const securedToViolation = (
    graph: EphemeraLudicGraph,
    hostId: EphemeraMembershipHostId,
    subjectId: EphemeraLudicTerminalId,
    targetId: EphemeraLudicTerminalId
): string | undefined => endpointViolation(graph, hostId, subjectId) ?? endpointViolation(graph, hostId, targetId)
