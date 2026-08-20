import { isEphemeraLudicGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

/**
 * A `Meta::*.ludicGraph` row is stale iff the shipped shape guard rejects it (LP4i) --- this
 * is a caller of that guard, not a second theory of staleness, so the two can never drift
 * apart. An absent `ludicGraph` is not stale: it means "not yet written," not "written and
 * wrong," and the guard's own contract only speaks to payloads that exist.
 */
export const isLudicGraphStructurallyStale = (ludicGraph: unknown): boolean => {
    if (ludicGraph === undefined) {
        return false
    }
    return !isEphemeraLudicGraphFieldPayload(ludicGraph)
}
