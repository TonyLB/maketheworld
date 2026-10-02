import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { SpanCandidatePool } from './spanResolution'

/**
 * The Object candidates for one `stableRefKey`'s pool, preferring the gap-trimmed shortlist
 * over the full candidate list (`resolvedSpansFromPools`' old preference). Describe and
 * Rehost read a pool directly for this: neither ever constructs a `currentHost` referent, so
 * there is no derived half to combine it with --- Grounding's `ReferentAssignment` shape
 * doesn't apply here, only a plain lookup.
 */
export function objectCandidatesForSpan(
    spanPools: ReadonlyMap<string, SpanCandidatePool>,
    stableRefKey: string
): readonly EphemeraObjectId[] {
    const pool = spanPools.get(stableRefKey)
    if (pool === undefined) {
        return []
    }
    return (pool.shortlist ?? pool.candidates).map((candidate) => candidate.id).filter(isEphemeraObjectId)
}
