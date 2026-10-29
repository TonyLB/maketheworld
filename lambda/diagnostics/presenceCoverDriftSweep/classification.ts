import { classifyPresenceCoverDrift, coverRebuildsFor, lacksBase, orphanRepairsFor, orphanedPointersOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { isEphemeraLudicBindingAddress } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { ConnectedToPair, PresenceBindingView, PresenceCoverDriftFinding, PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

/**
 * A stored `ludicGraph` read as the plain view the shared comparison takes. Read from the raw row,
 * since this lambda cannot import ephemera's graph class. A row that is not an object with a
 * `nodes` array yields no view; the stale-structure sweep owns that case.
 */
export const presenceGraphViewOf = (hostId: string, ludicGraph: unknown): PresenceGraphView | undefined => {
    const nodes = (ludicGraph as { nodes?: unknown } | undefined)?.nodes
    if (!Array.isArray(nodes)) {
        return undefined
    }
    const nodeIds: string[] = []
    const presenceNodes: PresenceBindingView[] = []
    for (const node of nodes) {
        if (typeof node === 'string') {
            nodeIds.push(node)
            continue
        }
        const { tag, universalKey } = (node ?? {}) as { tag?: unknown; universalKey?: unknown }
        if (typeof universalKey !== 'string') {
            continue
        }
        if (tag === 'Presence') {
            const { fromHostPresences, cover } = node as { fromHostPresences?: PresenceBindingView['fromHostPresences']; cover?: PresenceBindingView['cover'] }
            presenceNodes.push({ universalKey, fromHostPresences: Array.isArray(fromHostPresences) ? fromHostPresences : [], cover: Array.isArray(cover?.members) ? cover : { members: [] } })
        }
        else {
            nodeIds.push(universalKey)
        }
    }
    return { hostId, nodeIds, presenceNodes, connectedTo: connectedToOf(hostId, ludicGraph) }
}

/** A binding address the host itself owns: one of its own bindings, by key. */
const ownBindingOf = (hostId: string, endpoint: unknown): string | undefined => (
    isEphemeraLudicBindingAddress(endpoint) && endpoint.owner === hostId ? endpoint.port : undefined
)

/** The row's `ConnectedTo` edges between two of its own bindings, as binding keys (the contraction rule reads them). */
const connectedToOf = (hostId: string, ludicGraph: unknown): ConnectedToPair[] => {
    const edges = (ludicGraph as { edges?: unknown } | undefined)?.edges
    return (Array.isArray(edges) ? edges : []).flatMap((edge): ConnectedToPair[] => {
        const { tag, kind, from, to } = (edge ?? {}) as { tag?: unknown; kind?: unknown; from?: unknown; to?: unknown }
        const ends = [ownBindingOf(hostId, from), ownBindingOf(hostId, to)]
        return tag === 'Relational' && kind === 'ConnectedTo' && ends[0] && ends[1] ? [[ends[0], ends[1]]] : []
    })
}

/**
 * One host's verdict. This sweep is the one authority for pointer, node and cover agreement (both
 * directions) and for the binding-set rules (`noBase`, `SecondHostless`, `BadUnplaced`), for every
 * kind and every producer. Whether a fixed nesting matches its authored asset is
 * `FixedContainmentDriftSweep`'s; the one overlap is a Room or Area with bindings and no Base.
 */
export type PresenceCoverDriftClassification = {
    /** Drift the heal can rewrite (a cover rebuild, or a same-pointer repair of an orphaned binding): the only kinds that earn a finding. */
    healable: boolean
    /** A host with bindings and no `PRESENCE#Base`; report-only (every writer mints Base, so a heal would invent one). */
    noBase: boolean
    /** Pointer-versus-cover mismatches (unbound, duplicate, stale, uncovered); report-only (minting is a third emitter). */
    findings: PresenceCoverDriftFinding[]
}

/** Judges one host against its members' rows. `viewOf` returns a member's view, or `undefined` if it has no row. */
export const classifyHost = (
    host: PresenceGraphView,
    viewOf: (hostId: string) => PresenceGraphView | undefined
): PresenceCoverDriftClassification => {
    const verdict = classifyPresenceCoverDrift(host, viewOf)
    // The row is also judged as a member: a pointer of its own whose host lacks its node (the orphan direction).
    // Only report-only orphans become findings; a repairable one is carried by `healable`.
    const orphans = orphanedPointersOf(host, viewOf).filter((orphan) => !orphan.repairable).map((orphan): PresenceCoverDriftFinding => ({ kind: 'Orphaned', host: orphan.host, presence: orphan.presence }))
    return {
        healable: coverRebuildsFor(host, viewOf).length > 0 || orphanRepairsFor(host, viewOf).length > 0,
        noBase: lacksBase(host),
        findings: [...verdict.findings, ...orphans],
    }
}
