import type { EmbedObjectSpanResult } from '../../../../objects/embedding/embedObjectSpan'
import { createSpanEmbedCache, getOrEmbedSpan } from './spanEmbedCache'
import { simulateEmbeddingIdentity } from './simulateEmbeddingIdentity'
import type { EmbeddingMatchCandidate, EmbeddingMatchDecision } from './types'

export type ResolveObjectSpanByEmbeddingDeps = {
    embedSpan?: (rawObjectSpan: string) => Promise<EmbedObjectSpanResult>
    spanEmbedCache?: ReturnType<typeof createSpanEmbedCache>
}

/**
 * v1 calibration shim: embed span -> rank -> decideEmbeddingMatch.
 * Production identity path uses resolveCatalogSpanToPool (FT-2.1) instead.
 */
export async function resolveObjectSpanByEmbedding(
    rawObjectSpan: string,
    candidates: readonly EmbeddingMatchCandidate[],
    deps: ResolveObjectSpanByEmbeddingDeps = {}
): Promise<EmbeddingMatchDecision> {
    const cache = deps.spanEmbedCache ?? createSpanEmbedCache()
    const embedResult = await getOrEmbedSpan(rawObjectSpan, cache, deps)

    if (!embedResult.success) {
        return { type: 'Abstain', reason: 'embed_invoke_failed' }
    }

    return simulateEmbeddingIdentity(embedResult.embedding, candidates)
}
