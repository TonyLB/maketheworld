import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import type { EmbeddingMatchCandidate } from '../types'
import { tokenOverlapRelevance } from './tokenOverlapRelevance'

export type TokenOverlapRankedScore = {
    objectId: EmbeddingMatchCandidate['objectId']
    catalogScope: EmbeddingMatchCandidate['catalogScope']
    lexicalScore: number
}

/**
 * Simulator-only A/B baseline: rank catalog by token-overlap lexical relevance.
 * Not used on the production identity path.
 */
export function rankCatalogByTokenOverlap(
    rawObjectSpan: string,
    candidates: readonly EmbeddingMatchCandidate[]
): TokenOverlapRankedScore[] {
    const normalizedSpan = normalizeShortNameForEmbedding(rawObjectSpan)
    const scored: TokenOverlapRankedScore[] = candidates.map((candidate) => ({
        objectId: candidate.objectId,
        catalogScope: candidate.catalogScope,
        lexicalScore: tokenOverlapRelevance(normalizedSpan, candidate.normalizedShortName),
    }))
    return scored.sort((left, right) => right.lexicalScore - left.lexicalScore)
}
