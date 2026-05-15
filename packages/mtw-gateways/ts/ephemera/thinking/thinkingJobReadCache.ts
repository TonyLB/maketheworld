import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import type { EphemeraThinkingReadDB, ThinkingJobReadSnapshot } from './fetch'
import { fetchThinkingJobSnapshot } from './fetch'

/**
 * Per-invocation `DeferredCache` for thinking **job** snapshots: **`Meta::Job`** + adjacency
 * **`Query`** + per-work-item schedule **`GetItem`**. Cache key is **`generationId`**. Ephemera
 * registers one instance on `InternalCache`; writers should **`invalidate(generationId)`** after
 * any write that touches that job partition.
 */
export class ThinkingJobReadCache {
    readonly _Cache: DeferredCache<ThinkingJobReadSnapshot>
    private _Store: Record<string, ThinkingJobReadSnapshot> = {}

    constructor(private readonly db: EphemeraThinkingReadDB) {
        this._Cache = new DeferredCache<ThinkingJobReadSnapshot>({
            callback: (key, value) => {
                this._Store[key] = value
            },
            defaultValue: (generationId) => ({
                generationId,
                jobStatus: null,
                workItemIds: [],
                schedules: [],
            }),
        })
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
        this._Store = {}
    }

    async get(generationId: string): Promise<ThinkingJobReadSnapshot> {
        if (!this._Cache.isCached(generationId)) {
            this._Cache.add({
                promiseFactory: () => fetchThinkingJobSnapshot(this.db, generationId),
                requiredKeys: [generationId],
                transform: (fetched) => ({ [generationId]: fetched }),
            })
        }
        await this._Cache.get(generationId)
        return this._Store[generationId]
    }

    invalidate(generationId: string): void {
        delete this._Store[generationId]
        this._Cache.invalidate(generationId)
    }
}

export const createThinkingJobReadCacheHandler = (db: EphemeraThinkingReadDB): ThinkingJobReadCache =>
    new ThinkingJobReadCache(db)
