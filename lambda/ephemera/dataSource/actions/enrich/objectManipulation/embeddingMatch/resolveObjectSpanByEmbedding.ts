import internalCache from '../../../../../internalCache'
import { simulateEmbeddingIdentity } from './simulateEmbeddingIdentity'
import type { EmbeddingMatchCandidate, EmbeddingMatchDecision } from './types'

/**
 * v1 calibration shim: embed span -> rank -> decideEmbeddingMatch.
 * Production identity path uses resolveCatalogSpanToPool (FT-2.1) instead.
 */
export async function resolveObjectSpanByEmbedding(
    rawObjectSpan: string,
    candidates: readonly EmbeddingMatchCandidate[]
): Promise<EmbeddingMatchDecision> {
    const embedResult = await internalCache.SpanEmbeddings.get(rawObjectSpan)

    if (!embedResult.success) {
        return { type: 'Abstain', reason: 'embed_invoke_failed' }
    }

    return simulateEmbeddingIdentity(embedResult.embedding, candidates)
}
