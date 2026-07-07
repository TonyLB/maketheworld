import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import type { EmbeddingMatchCandidate } from './types'

export function catalogHasDuplicateNormalizedShortNames(
    candidates: readonly EmbeddingMatchCandidate[]
): boolean {
    const seen = new Set<string>()
    for (const candidate of candidates) {
        const normalized = normalizeShortNameForEmbedding(candidate.normalizedShortName)
        if (seen.has(normalized)) {
            return true
        }
        seen.add(normalized)
    }
    return false
}
