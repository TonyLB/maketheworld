import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { SemanticEmbedding } from '@tonylb/mtw-lambda-patterns/ts/semanticEmbedding'

import { fetchObjectEmbeddingsImpromptu, type EphemeraObjectEmbeddingReadDB } from './fetch'
import { objectEmbeddingCacheKey } from './keys'

/**
 * Per-invocation read + memo handler for ephemeraDB object embedding rows
 * `(OBJECT#, EMBEDDING#IMPROMPTU)`. Dynamo writes stay in objects persistence; memo APIs patch in-memory state only.
 */
export class ObjectEmbeddingCacheHandler {
    readonly _Cache: DeferredCache<SemanticEmbedding | undefined>
    private _Store: Record<string, SemanticEmbedding | undefined> = {}

    constructor(private readonly db: EphemeraObjectEmbeddingReadDB) {
        this._Cache = new DeferredCache<SemanticEmbedding | undefined>({
            callback: (key, value) => {
                this._Store[key] = value
            },
            defaultValue: () => undefined,
        })
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
        this._Store = {}
    }

    private async ensureCached(objectIds: readonly EphemeraObjectId[]): Promise<void> {
        const uncachedIds = objectIds.filter((objectId) => !this._Cache.isCached(objectEmbeddingCacheKey(objectId)))
        if (uncachedIds.length === 0) {
            return
        }

        const requiredKeys = uncachedIds.map((objectId) => objectEmbeddingCacheKey(objectId))
        this._Cache.add({
            promiseFactory: () => fetchObjectEmbeddingsImpromptu(this.db, uncachedIds),
            requiredKeys,
            transform: (fetched) =>
                uncachedIds.reduce<Record<string, SemanticEmbedding | undefined>>((previous, objectId) => ({
                    ...previous,
                    [objectEmbeddingCacheKey(objectId)]: fetched[objectId],
                }), {}),
        })

        await Promise.all(requiredKeys.map((cacheKey) => this._Cache.get(cacheKey)))
    }

    async get(
        objectIds: readonly EphemeraObjectId[]
    ): Promise<Record<EphemeraObjectId, SemanticEmbedding | undefined>> {
        const uniqueIds = [...new Set(objectIds)]
        await this.ensureCached(uniqueIds)

        return objectIds.reduce<Record<EphemeraObjectId, SemanticEmbedding | undefined>>(
            (previous, objectId) => ({
                ...previous,
                [objectId]: this._Store[objectEmbeddingCacheKey(objectId)],
            }),
            {}
        )
    }

    set(objectId: EphemeraObjectId, embedding: SemanticEmbedding): void {
        const cacheKey = objectEmbeddingCacheKey(objectId)
        this._Cache.set(Infinity, cacheKey, embedding)
        this._Store[cacheKey] = embedding
    }

    invalidate(objectId: EphemeraObjectId): void {
        const cacheKey = objectEmbeddingCacheKey(objectId)
        delete this._Store[cacheKey]
        this._Cache.invalidate(cacheKey)
    }
}

export const createObjectEmbeddingCacheHandler = (
    db: EphemeraObjectEmbeddingReadDB
): ObjectEmbeddingCacheHandler => new ObjectEmbeddingCacheHandler(db)
