import {
    ephemeraLudicTerminalsEqual,
    isEphemeraLudicGraphFieldPayload,
} from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    EphemeraCrossingPort,
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

/** The exterior-scope values a port denormalizes: the referring edge's kind and label. */
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

/**
 * The edge side narrows; the port side does not. `LudicGraphPortExteriorValues` stays flat
 * (`kind` plus an optional label) because `EphemeraLudicGraphPort` does --- moving the port
 * record's label onto a crossing-only branch is scheduled work, not an open question (PR-15
 * settled 2026-08-26; EA-10 is still open on its own axis). All that changed here is that a
 * non-`Custom` edge no longer *has* a label to read.
 */
const exteriorValuesOfEdge = (edge: EphemeraLudicRelationalEdgeData): LudicGraphPortExteriorValues => (
    edge.kind === 'Custom'
        ? { kind: 'Custom', exteriorRelationLabel: edge.relationLabel }
        : { kind: edge.kind }
)

const exteriorValuesEqual = (a: LudicGraphPortExteriorValues, b: LudicGraphPortExteriorValues): boolean => (
    a.kind === b.kind && a.exteriorRelationLabel === b.exteriorRelationLabel
)

/**
 * The edges in the referrer's graph **incident to** this port --- either terminal may be the
 * port address (`{ owner: hostId, port: portId }`), since which end of an edge is the host is a
 * kind-by-kind question (AB-54) and not this comparison's business.
 *
 * **Incidence, not crossing, and the distinction is load-bearing.** An edge that *crosses* a port
 * and an edge that *terminates at* one are both incident to it, and nothing in the stored edge
 * distinguishes them --- the difference is whether a partner edge exists interior-side, which is
 * not on this row. So this stays a pure incidence query and the caller decides what incidence
 * means for the port kind in hand.
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
 * itself names (the port-record conflict rule in `positions/AGENT.contract.md`: compare where
 * comparison is possible, and where
 * an exterior reference exists it governs).
 *
 * **Crossing ports only, as of presenceNodes Slice 3 (PN-9 item (c)); unconditionally so as of
 * Slice 7a (PN-3/PN-23).** A presence binding is a node, not a port-list tenant, and since
 * Slice 7a it carries no port record at all --- both callers (`ludicGraphPortMismatchSweep`,
 * `healLudicGraphPortMismatch`) once filtered presence ports out before calling this, but there
 * are none left to filter. There is nothing here to dispatch on `kind === 'Present'` for, and the
 * branch that used to do that retired with them.
 *
 * **The AB-55 tolerance survives for an absent or unparseable referrer; it does NOT survive for a
 * well-formed referrer holding no edge into this port --- PN-9 item (c), and the two used to
 * collapse to the same early return.** *Who should refer here* is still not this comparison's
 * question when the referrer's row cannot be read at all (unmaterialized, still catching up, or
 * shape-stale --- `ludicGraphStaleStructureSweep`'s finding, not this one's). But once the
 * referrer's graph parses, the old tolerance was covering a second, different case: a port with
 * no exterior edge could legitimately be a presence indicator (P3's retired default 2). With
 * presence off the port list entirely, every surviving port kind is required to have exactly one
 * exterior edge (PR-15/AGENT.contract.md's tightened conflict rule) once its referrer is legible,
 * so a well-formed referrer with no matching edge is now itself the disagreement to report, with
 * no correction to offer (the fix is authoring the missing edge, not rewriting the port's own
 * fields).
 */
export const classifyLudicGraphPortMismatch = (args: {
    hostId: EphemeraMembershipHostId
    port: EphemeraCrossingPort
    referrerLudicGraph: unknown
}): LudicGraphPortMismatchVerdict => {
    const matchingEdges = edgesReferringToPort({
        hostId: args.hostId,
        portId: args.port.portId,
        referrerLudicGraph: args.referrerLudicGraph,
    })
    if (!matchingEdges.length) {
        return isEphemeraLudicGraphFieldPayload(args.referrerLudicGraph)
            ? { mismatch: true }
            : { mismatch: false }
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
