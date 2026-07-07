import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import type { EmbeddingMatchCandidate, EmbeddingMatchRankedScore } from './types'

export function rankCatalogByCosineSimilarity(
    spanEmbedding: SemanticEmbedding,
    candidates: readonly EmbeddingMatchCandidate[]
): EmbeddingMatchRankedScore[] {
    const scored: EmbeddingMatchRankedScore[] = []
    for (const candidate of candidates) {
        if (!candidate.embedding) {
            continue
        }
        scored.push({
            objectId: candidate.objectId,
            catalogScope: candidate.catalogScope,
            similarity: spanEmbedding.cosineSimilarity(candidate.embedding),
        })
    }
    return scored.sort((left, right) => right.similarity - left.similarity)
}
