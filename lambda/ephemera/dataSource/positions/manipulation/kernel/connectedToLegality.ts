import { hostingFamily } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'

const describeTerminal = (terminal: EphemeraLudicTerminalId): string => typeof terminal === 'string' ? terminal : `${terminal.owner}/${terminal.port}`

/**
 * Why `terminal` cannot be an endpoint of a `ConnectedTo` edge in `hostId`'s graph, or undefined if it can.
 * `ConnectedTo` joins parts of one whole, so an endpoint is the whole itself, one of its bindings (a
 * port address the whole owns, whether or not it also has named parts), or a part of it (a node whose
 * hosting kind is a composition kind, `PartOf` or `SectionOf`). A part's own parts live in the part's graph, not this one.
 */
const endpointViolation = (graph: EphemeraLudicGraph, hostId: EphemeraMembershipHostId, terminal: EphemeraLudicTerminalId): string | undefined => {
    if (typeof terminal !== 'string') {
        return terminal.owner === hostId ? undefined : `${describeTerminal(terminal)} is a binding of ${terminal.owner}, not of ${hostId}`
    }
    if (terminal === hostId) {
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
