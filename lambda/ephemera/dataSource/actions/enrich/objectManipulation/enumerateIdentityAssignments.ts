import { identityFromSpanCandidate, type IdentityPlanIdentity } from './identityPlanCandidate'
import type { ObjectSpanCandidate } from './spanResolution'

/** One joint assignment: an identity per `stableRefKey`, with its `min` confidence. */
/** One joint identity assignment: one id per `stableRefKey`, with its confidence (by `min`). */
export type IdentityAssignment = {
    identities: ReadonlyMap<string, IdentityPlanIdentity>
    confidence: number
}

/**
 * Forms the product in "plans × identity candidates": every joint assignment over the
 * given pools, one candidate per `stableRefKey`. Confidence is the `min` over the chosen
 * candidates' `jointRelevance`, so with one key it is that candidate's own.
 *
 * Route-agnostic: it never sees a step's primitive, and the caller passes only the keys
 * of phrase-named referents (derived referents ground later, in the executor). Which
 * candidates each key admits (shortlist preference, route filters) is the caller's call.
 *
 * Order follows the map's insertion order, first key outermost; a single pool keeps its
 * own order. An empty pool, or no pools at all, yields no assignments.
 */
export function enumerateIdentityAssignments(
    pools: ReadonlyMap<string, readonly ObjectSpanCandidate[]>
): IdentityAssignment[] {
    if (pools.size === 0) {
        return []
    }
    type PartialAssignment = { entries: [string, ObjectSpanCandidate][]; confidence: number }
    // The cross product of all the candidate pools: each step extends every partial
    // assignment so far by every candidate in the next key's pool.
    const assignments = [...pools].reduce<PartialAssignment[]>(
        (partials, [stableRefKey, candidates]) => partials.flatMap((partial) =>
            candidates.map((candidate) => ({
                entries: [...partial.entries, [stableRefKey, candidate] as [string, ObjectSpanCandidate]],
                confidence: Math.min(partial.confidence, candidate.jointRelevance),
            }))
        ),
        [{ entries: [], confidence: Infinity }]
    )
    return assignments.map(({ entries, confidence }) => ({
        identities: new Map(entries.map(([stableRefKey, candidate]) => [stableRefKey, identityFromSpanCandidate(candidate)])),
        confidence,
    }))
}
