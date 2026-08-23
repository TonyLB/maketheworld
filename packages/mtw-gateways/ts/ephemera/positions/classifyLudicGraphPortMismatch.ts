import {
    ephemeraLudicTerminalsEqual,
    isEphemeraLudicGraphFieldPayload,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    EphemeraLudicGraphPort,
    EphemeraLudicRelationalEdgeData,
    HostRelationalEdgeKind,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

/**
 * Lives in the shared package, not in either caller: the same comparison is the diagnostics
 * sweep's classifier (`lambda/diagnostics/ludicGraphPortMismatchSweep/`) and the ephemera
 * self-heal's recheck (`positions/ludicGraph/healLudicGraphPortMismatch.ts`). One definition of
 * *disagreement* across both, on the precedent of `classifyAuthoredCatalogDrift`.
 */

/** The exterior-scope values a port denormalizes (LP6): the referring edge's kind and label. */
export type LudicGraphPortExteriorValues = {
    kind: HostRelationalEdgeKind
    exteriorRelationLabel?: string
}

/**
 * `correction` present: the matching exterior edges agree with each other and disagree with the
 * port, so there is a single right answer to write. `correction` absent on a mismatch: the
 * exterior fan disagrees with *itself*, which is reportable but not repairable --- a port's
 * single-use lifecycle means one crossing, so a split fan is broken exteriorly and picking one
 * of its edges to believe would be inventing an answer.
 */
export type LudicGraphPortMismatchVerdict =
    | { mismatch: false }
    | { mismatch: true; correction?: LudicGraphPortExteriorValues }

const exteriorValuesOfEdge = (edge: EphemeraLudicRelationalEdgeData): LudicGraphPortExteriorValues => ({
    kind: edge.kind,
    ...(edge.relationLabel === undefined ? {} : { exteriorRelationLabel: edge.relationLabel }),
})

const exteriorValuesEqual = (a: LudicGraphPortExteriorValues, b: LudicGraphPortExteriorValues): boolean => (
    a.kind === b.kind && a.exteriorRelationLabel === b.exteriorRelationLabel
)

/**
 * The edges in the referrer's graph that cross into this port --- either terminal may be the
 * port address (`{ owner: hostId, port: portId }`), since which end of an edge is the host is a
 * kind-by-kind question (AB-54/LD-16) and not this comparison's business.
 */
export const edgesReferringToPort = (args: {
    hostId: EphemeraMembershipHostId
    portId: string
    referrerLudicGraph: unknown
}): EphemeraLudicRelationalEdgeData[] => {
    // Both sides are read through the shipped payload guard rather than a looser local check:
    // this sweep is a *comparison* of two well-formed graphs, and a graph that fails the shape
    // guard is already `ludicGraphStaleStructureSweep`'s finding, not a second one here. That
    // orders the two sweeps rather than duplicating them --- structure is healed first, and the
    // comparison then runs against a row that parses.
    if (!isEphemeraLudicGraphFieldPayload(args.referrerLudicGraph)) {
        return []
    }
    const portAddress = { owner: args.hostId, port: args.portId }
    return (args.referrerLudicGraph.edges ?? []).filter((edge) => (
        ephemeraLudicTerminalsEqual(edge.from, portAddress) || ephemeraLudicTerminalsEqual(edge.to, portAddress)
    ))
}

/**
 * Compare one port's denormalized exterior values against the edge held by the host the port
 * itself names (LD-18, premise 12's amendment: compare where comparison is possible, and where
 * an exterior reference exists it governs).
 *
 * **Scoped to a named referrer, and the gate is deliberate.** No matching edge --- because the
 * referrer's graph is absent, fails the shape guard, holds no edge into this port, or holds one
 * into a *different* port on the same owner --- is **not** a mismatch. That case asks *who
 * should refer here*, which only the reverse index answers (LD-17/AB-55), and answering it by
 * flagging every unreferenced port would report the whole corpus as broken.
 */
export const classifyLudicGraphPortMismatch = (args: {
    hostId: EphemeraMembershipHostId
    port: EphemeraLudicGraphPort
    referrerLudicGraph: unknown
}): LudicGraphPortMismatchVerdict => {
    const matchingEdges = edgesReferringToPort({
        hostId: args.hostId,
        portId: args.port.portId,
        referrerLudicGraph: args.referrerLudicGraph,
    })
    if (!matchingEdges.length) {
        return { mismatch: false }
    }

    const recorded: LudicGraphPortExteriorValues = {
        kind: args.port.kind,
        ...(args.port.exteriorRelationLabel === undefined ? {} : { exteriorRelationLabel: args.port.exteriorRelationLabel }),
    }
    const exterior = matchingEdges.map(exteriorValuesOfEdge)
    const unanimous = exterior.every((values) => exteriorValuesEqual(values, exterior[0]))
    if (!unanimous) {
        return { mismatch: true }
    }
    if (exteriorValuesEqual(recorded, exterior[0])) {
        return { mismatch: false }
    }
    return { mismatch: true, correction: exterior[0] }
}
