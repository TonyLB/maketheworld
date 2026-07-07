import { T_ABS, T_ABS_UNARY, T_MARGIN } from './thresholds'
import type { EmbeddingMatchDecision, EmbeddingMatchRankedScore } from './types'

/**
 * Conjunctive gates for embedding identity fast path.
 * Full unit-test coverage against calibration corpus (mocked vectors) lands in EM-2.
 */
export function decideEmbeddingMatch(
    rankedScores: readonly EmbeddingMatchRankedScore[],
    eligibleCount: number,
    hasDuplicateShortNames: boolean
): EmbeddingMatchDecision {
    if (hasDuplicateShortNames) {
        return { type: 'Abstain', reason: 'ambiguous_margin' }
    }
    if (eligibleCount === 0) {
        return { type: 'Abstain', reason: 'no_eligible_embeddings' }
    }
    const best = rankedScores[0]
    if (!best) {
        return { type: 'Abstain', reason: 'no_eligible_embeddings' }
    }

    const floor = eligibleCount === 1 ? T_ABS_UNARY : T_ABS
    if (best.similarity < floor) {
        return { type: 'Abstain', reason: 'below_floor' }
    }

    if (eligibleCount >= 2) {
        const second = rankedScores[1]
        if (!second || best.similarity - second.similarity < T_MARGIN) {
            return { type: 'Abstain', reason: 'ambiguous_margin' }
        }
    }

    return {
        type: 'Resolved',
        objectId: best.objectId,
        catalogScope: best.catalogScope,
    }
}
