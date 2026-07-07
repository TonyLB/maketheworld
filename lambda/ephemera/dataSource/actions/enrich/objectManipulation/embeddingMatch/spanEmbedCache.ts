import type { EmbedObjectSpanResult } from '../../../../objects/embedding/embedObjectSpan'
import { embedObjectSpan } from '../../../../objects/embedding/embedObjectSpan'
import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import type { ResolveObjectSpanByEmbeddingDeps } from './resolveObjectSpanByEmbedding'

export type SpanEmbedCache = Map<string, EmbedObjectSpanResult>

export const createSpanEmbedCache = (): SpanEmbedCache => new Map()

export async function getOrEmbedSpan(
    rawObjectSpan: string,
    cache: SpanEmbedCache,
    deps: ResolveObjectSpanByEmbeddingDeps = {}
): Promise<EmbedObjectSpanResult> {
    const normalized = normalizeShortNameForEmbedding(rawObjectSpan)
    const cached = cache.get(normalized)
    if (cached !== undefined) {
        return cached
    }

    const embedSpan = deps.embedSpan ?? embedObjectSpan
    const result = await embedSpan(rawObjectSpan)
    cache.set(normalized, result)
    return result
}
