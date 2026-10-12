import { classifyPresenceCoverDrift, coverRebuildsFor } from '@tonylb/mtw-gateways/ts/ephemera/positions'
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
    /** Drift the cover-rebuild heal can rewrite: the only kind that earns a finding. */
    healable: boolean
    /** A whole with members and no remainder; report-only (a heal would invent a bucket). */
    noRemainder: boolean
    /** Pointer-versus-cover mismatches (unbound, duplicate, stale); report-only (minting is a third emitter). */
    findings: PresenceCoverDriftFinding[]
}

/** Judges one whole against its members' rows. `viewOf` returns a member's view, or `undefined` if it has no row. */
export const classifyWhole = (
    whole: PresenceGraphView,
    viewOf: (hostId: string) => PresenceGraphView | undefined
): PresenceCoverDriftClassification => {
    const verdict = classifyPresenceCoverDrift(whole, viewOf)
    const hasMembers = whole.nodeIds.some((id) => id !== whole.hostId && !id.startsWith('PRESENCE#'))
    return {
        healable: coverRebuildsFor(whole, viewOf).length > 0,
        noRemainder: verdict.noRemainder && hasMembers,
        findings: verdict.findings,
    }
}
