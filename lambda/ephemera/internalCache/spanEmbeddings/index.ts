import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache/deferredCache'

import { peelLeadingArticleWhenTail } from '../../dataSource/actions/enrich/objectManipulation/spanMatchForms'
import { normalizeShortNameForEmbedding } from '../../dataSource/objects/embedding/impromptuEmbeddingNeedsRefresh'
import { embedObjectSpan, type EmbedObjectSpanResult } from './embedObjectSpan'

export type {
    EmbedObjectSpanDeps,
    EmbedObjectSpanFailure,
    EmbedObjectSpanResult,
    EmbedObjectSpanSuccess,
} from './embedObjectSpan'

/**
 * Cache key and Bedrock request text for a span: `cup`, `the cup` and `  The  Cup ` are one key.
 */
export const spanEmbeddingKey = (span: string): string =>
    normalizeShortNameForEmbedding(peelLeadingArticleWhenTail(span))

/**
 * Per-invocation memo of span embeddings (one Bedrock Titan call per trimmed span). The `DeferredCache`
 * shares an in-flight fetch between concurrent requests for one key, so callers can start every span's
 * embed before awaiting any of them.
 */
export class SpanEmbeddingsCache {
    _Cache: DeferredCache<EmbedObjectSpanResult>;

    constructor() {
        this._Cache = new DeferredCache<EmbedObjectSpanResult>()
    }

    async get(span: string): Promise<EmbedObjectSpanResult> {
        const key = spanEmbeddingKey(span)
        if (!this._Cache.isCached(key)) {
            this._Cache.add({
                promiseFactory: () => this._embed(key),
                requiredKeys: [key],
                transform: (result) => ({ [key]: result }),
            })
        }
        return this._Cache.get(key)
    }

    /**
     * Never rejects: `DeferredCache` leaves a key's Deferred unsettled when its factory rejects, which
     * would hang every awaiter. A failure is "no embedding channel", memoized for the invocation.
     */
    async _embed(key: string): Promise<EmbedObjectSpanResult> {
        try {
            return await embedObjectSpan(key)
        }
        catch {
            return { success: false }
        }
    }

    async flush() {
        await this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }
}

export default SpanEmbeddingsCache
