import { ephemeraLudicTerminalKey, hostingFamily, matchEphemeraLudicTerminal } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'

const describeTerminal = (terminal: EphemeraLudicTerminalId): string =>
    matchEphemeraLudicTerminal(terminal, { component: (id) => id, port: (address) => `${address.owner}/${address.port}` })

/**
 * Why `terminal` cannot be an endpoint of a `ConnectedTo` edge in `hostId`'s graph, or undefined if it can.
 * `ConnectedTo` joins parts of one whole, so an endpoint is the whole itself, one of its bindings (a
 * port address the whole owns, whether or not it also has named parts), or a part of it (a node whose
 * hosting kind is a composition kind, `PartOf` or `SectionOf`). A part's own parts live in the part's graph, not this one.
 */
const endpointViolation = (graph: EphemeraLudicGraph, hostId: EphemeraMembershipHostId, terminal: EphemeraLudicTerminalId): string | undefined => {
    return matchEphemeraLudicTerminal(terminal, {
        port: (address) => address.owner === hostId ? undefined : `${describeTerminal(address)} is a binding of ${address.owner}, not of ${hostId}`,
        component: (id) => {
            if (id === hostId) {
                return undefined
            }
            const kind = graph.hostingKindOf(id)
            const isPart = kind !== undefined && hostingFamily(kind) === 'composition'
            return isPart
                ? undefined
                : `${id} is not a part of ${hostId}: a join between separate wholes is a peer relation (Custom), not ConnectedTo`
        }
    })
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
