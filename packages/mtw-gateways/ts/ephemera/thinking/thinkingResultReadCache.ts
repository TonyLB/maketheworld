import type { ThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import type { EphemeraThinkingReadDB } from './fetch'
import { fetchThinkingResult } from './fetch'

/**
 * Per-invocation `DeferredCache` for thinking **result** rows: **`GetItem`** on **`TASK#${workItemId}`** +
 * **`Meta::Result`**. Cache key is **`workItemId`** (UUID). Ephemera registers one instance on
 * `InternalCache`; writers should **`invalidate(workItemId)`** after persistence lands.
 */
export class ThinkingResultReadCache {
    readonly _Cache: DeferredCache<ThinkingResultEvent | null>
    private _Store: Record<string, ThinkingResultEvent | null> = {}

    constructor(private readonly db: EphemeraThinkingReadDB) {
        this._Cache = new DeferredCache<ThinkingResultEvent | null>({
            callback: (key, value) => {
                this._Store[key] = value
            },
            defaultValue: () => null,
        })
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
        this._Store = {}
    }

    async get(workItemId: string): Promise<ThinkingResultEvent | null> {
        if (!this._Cache.isCached(workItemId)) {
            this._Cache.add({
                promiseFactory: () => fetchThinkingResult(this.db, workItemId),
                requiredKeys: [workItemId],
                transform: (fetched) => ({ [workItemId]: fetched }),
            })
        }
        await this._Cache.get(workItemId)
        return this._Store[workItemId]
    }

    invalidate(workItemId: string): void {
        delete this._Store[workItemId]
        this._Cache.invalidate(workItemId)
    }
}

export const createThinkingResultReadCacheHandler = (db: EphemeraThinkingReadDB): ThinkingResultReadCache =>
    new ThinkingResultReadCache(db)
