import type { ResolvedSpan } from './synthesize/groundReferent'
import type { SpanCandidatePool } from './spanResolution'

/**
 * Step 2b step 6 glue: Identify's SpanCandidatePool (ranked ObjectSpanCandidate[]
 * with scores/loci) isn't the shape Grounding consumes (a flat candidateIds list
 * per stableRefKey, verdict 'resolved' | 'unresolved'). Prefers the gap-trimmed
 * shortlist over the full candidate list, the same preference
 * selectRelationalFromPools.ts already uses.
 */
export function resolvedSpansFromPools(
    spanPools: ReadonlyMap<string, SpanCandidatePool>
): ReadonlyMap<string, ResolvedSpan> {
    const result = new Map<string, ResolvedSpan>()
    for (const [stableRefKey, pool] of spanPools) {
        const candidates = pool.shortlist ?? pool.candidates
        result.set(
            stableRefKey,
            candidates.length === 0
                ? { verdict: 'unresolved', reason: `No candidates found for span "${pool.span}"` }
                : { verdict: 'resolved', candidateIds: candidates.map((candidate) => candidate.id) }
        )
    }
    return result
}
