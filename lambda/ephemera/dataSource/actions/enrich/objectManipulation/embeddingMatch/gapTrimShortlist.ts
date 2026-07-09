import type { ObjectSpanCandidate } from '../spanResolution'
import {
    POOL_GAP_TRIM_RELATIVE_DROP,
    POOL_SHORTLIST_TOP_N,
    type RelevanceNormalizationParams,
} from './thresholds'

export type GapTrimShortlistOptions = {
    topN?: number
    relativeDrop?: number
}

/**
 * Gap-trim shortlist: include ranked candidates until a relative score gap or Top-N ceiling.
 * Input must already be sorted by jointRelevance descending.
 */
export function gapTrimShortlist(
    rankedCandidates: readonly ObjectSpanCandidate[],
    params: RelevanceNormalizationParams = {},
    options: GapTrimShortlistOptions = {}
): readonly ObjectSpanCandidate[] {
    if (rankedCandidates.length === 0) {
        return []
    }

    const topN = options.topN ?? params.poolShortlistTopN ?? POOL_SHORTLIST_TOP_N
    const relativeDrop = options.relativeDrop ?? params.poolGapTrimRelativeDrop ?? POOL_GAP_TRIM_RELATIVE_DROP

    const shortlist: ObjectSpanCandidate[] = [rankedCandidates[0]!]

    for (let index = 0; index < rankedCandidates.length - 1; index++) {
        if (shortlist.length >= topN) {
            break
        }

        const current = rankedCandidates[index]!
        const next = rankedCandidates[index + 1]!
        const currentScore = current.jointRelevance

        if (currentScore > 0) {
            const drop = (currentScore - next.jointRelevance) / currentScore
            if (drop >= relativeDrop) {
                break
            }
        }

        shortlist.push(next)
    }

    return shortlist
}
