import { catalogHasDuplicateNormalizedShortNames } from './catalogHasDuplicateNormalizedShortNames'
import { decideEmbeddingMatch } from './decideEmbeddingMatch'
import { rankCatalogByCosineSimilarity } from './rankCatalogByCosineSimilarity'
import type { EmbeddingMatchCandidate, EmbeddingMatchDecision } from './types'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

export function simulateEmbeddingIdentity(
    spanEmbedding: SemanticEmbedding,
    candidates: readonly EmbeddingMatchCandidate[]
): EmbeddingMatchDecision {
    const rankedScores = rankCatalogByCosineSimilarity(spanEmbedding, candidates)
    const eligibleCount = candidates.filter((candidate) => candidate.embedding !== undefined).length
    const hasDuplicateShortNames = catalogHasDuplicateNormalizedShortNames(candidates)
    return decideEmbeddingMatch(rankedScores, eligibleCount, hasDuplicateShortNames)
}
