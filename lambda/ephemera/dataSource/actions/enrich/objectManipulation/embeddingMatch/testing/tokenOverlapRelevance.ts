import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

/**
 * FT-1 calibration baseline (not production): token-overlap heuristic for A/B vs substring edit distance.
 */
export function tokenOverlapRelevance(span: string, shortName: string): number {
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const normalizedShortName = normalizeShortNameForEmbedding(shortName)

    const spanTokens = normalizedSpan.split(' ').filter((token) => token.length > 0)
    const shortNameTokens = normalizedShortName.split(' ').filter((token) => token.length > 0)

    if (spanTokens.length === 0 || shortNameTokens.length === 0) {
        return 0
    }

    const shortNameTokenSet = new Set(shortNameTokens)
    const intersectionCount = spanTokens.filter((token) => shortNameTokenSet.has(token)).length
    return intersectionCount / spanTokens.length
}
