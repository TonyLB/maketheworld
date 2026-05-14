import type { ThinkingScheduleEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import type { EphemeraThinkingReadDB } from './fetch'
import { fetchThinkingSchedule } from './fetch'

/**
 * Per-invocation `DeferredCache` for thinking **schedule** rows: **`GetItem`** on **`TASK#${workItemId}`** +
 * **`Meta::Schedule`**. Cache key is **`workItemId`** (UUID). Ephemera registers one instance on
 * `InternalCache`; writers should **`invalidate(workItemId)`** after persistence lands.
 */
export class ThinkingScheduleReadCache {
    readonly _Cache: DeferredCache<ThinkingScheduleEvent | null>
    private _Store: Record<string, ThinkingScheduleEvent | null> = {}

    constructor(private readonly db: EphemeraThinkingReadDB) {
        this._Cache = new DeferredCache<ThinkingScheduleEvent | null>({
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

    async get(workItemId: string): Promise<ThinkingScheduleEvent | null> {
        if (!this._Cache.isCached(workItemId)) {
            this._Cache.add({
                promiseFactory: () => fetchThinkingSchedule(this.db, workItemId),
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

export const createThinkingScheduleReadCacheHandler = (db: EphemeraThinkingReadDB): ThinkingScheduleReadCache =>
    new ThinkingScheduleReadCache(db)
