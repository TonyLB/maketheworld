import { ephemeraLudicTerminalKey, hostingFamily, isEphemeraLudicBindingAddress, isEphemeraLudicCrossingPortAddress, isEphemeraLudicEdgeTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'

/**
 * Why `terminal` cannot be an endpoint of a `ConnectedTo` edge in `hostId`'s graph, or undefined if it can.
 * `ConnectedTo` joins parts of one whole, so an endpoint is the whole itself, one of its bindings (an own
 * binding, or a binding address the whole owns; legal whether or not the whole also has named parts), or a
 * part of it (a node whose hosting kind is a composition kind, `PartOf` or `SectionOf`). A crossing port
 * is not a binding. A part's own parts live in the part's graph, not this one.
 */
const endpointViolation = (graph: EphemeraLudicGraph, hostId: EphemeraMembershipHostId, terminal: EphemeraLudicTerminalId): string | undefined => {
    if (isEphemeraLudicEdgeTerminal(terminal)) {
        return `${ephemeraLudicTerminalKey(terminal)} is an edge: only Justifies carries an edge terminal`
    }
    if (isEphemeraLudicBindingAddress(terminal)) {
        return terminal.owner === hostId ? undefined : `${ephemeraLudicTerminalKey(terminal)} is a binding of ${terminal.owner}, not of ${hostId}`
    }
    if (isEphemeraLudicCrossingPortAddress(terminal)) {
        return `${ephemeraLudicTerminalKey(terminal)} is a crossing port of ${terminal.owner}, not a binding of ${hostId}`
    }
    if (terminal === hostId || isEphemeraPresenceNodeId(terminal)) {
        return undefined
    }
    const kind = graph.hostingKindOf(terminal)
    const isPart = kind !== undefined && hostingFamily(kind) === 'composition'
    return isPart
        ? undefined
        : `${terminal} is not a part of ${hostId}: a join between separate wholes is a peer relation (Custom), not ConnectedTo`
}

/**
 * The legality rule for establishing a `ConnectedTo` edge in `hostId`'s graph: both endpoints must be
 * the whole, its bindings or its parts. A violation means a producer wrote the wrong kind, so the
 * kernel throws rather than returning a verdict.
 */
export const connectedToViolation = (
    graph: EphemeraLudicGraph,
    hostId: EphemeraMembershipHostId,
    subjectId: EphemeraLudicTerminalId,
    targetId: EphemeraLudicTerminalId
): string | undefined => endpointViolation(graph, hostId, subjectId) ?? endpointViolation(graph, hostId, targetId)
