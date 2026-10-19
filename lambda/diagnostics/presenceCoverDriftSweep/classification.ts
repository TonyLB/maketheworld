import { classifyPresenceCoverDrift, coverRebuildsFor, lacksBase, orphanRepairsFor, orphanedPointersOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceBindingView, PresenceCoverDriftFinding, PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'

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
            const { fromHostPresence, cover } = node as { fromHostPresence?: PresenceBindingView['fromHostPresence']; cover?: PresenceBindingView['cover'] }
            presenceNodes.push({ universalKey, fromHostPresence, cover: Array.isArray(cover?.members) ? cover : { members: [] } })
        }
        else {
            nodeIds.push(universalKey)
        }
    }
    return { hostId, nodeIds, presenceNodes }
}

export type PresenceCoverDriftClassification = {
    /** Drift the heal can rewrite (a cover rebuild, or a same-pointer repair of an orphaned binding): the only kinds that earn a finding. */
    healable: boolean
    /** A whole with bindings and no `PRESENCE#Base`; report-only (every writer mints Base, so a heal would invent one). */
    noBase: boolean
    /** Pointer-versus-cover mismatches (unbound, duplicate, stale, uncovered); report-only (minting is a third emitter). */
    findings: PresenceCoverDriftFinding[]
}

/** Judges one whole against its members' rows. `viewOf` returns a member's view, or `undefined` if it has no row. */
export const classifyWhole = (
    whole: PresenceGraphView,
    viewOf: (hostId: string) => PresenceGraphView | undefined
): PresenceCoverDriftClassification => {
    const verdict = classifyPresenceCoverDrift(whole, viewOf)
    // The row is also judged as a member: a pointer of its own whose host lacks its node (the orphan direction).
    // Only report-only orphans become findings; a repairable one is carried by `healable`.
    const orphans = orphanedPointersOf(whole, viewOf).filter((orphan) => !orphan.repairable).map((orphan): PresenceCoverDriftFinding => ({ kind: 'Orphaned', host: orphan.host, presence: orphan.presence }))
    return {
        healable: coverRebuildsFor(whole, viewOf).length > 0 || orphanRepairsFor(whole, viewOf).length > 0,
        noBase: lacksBase(whole),
        findings: [...verdict.findings, ...orphans],
    }
}
