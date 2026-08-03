import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraAffordanceCacheReadDB } from './fetch'
import {
    getAffordanceRowFromDynamo,
    queryAffordanceRowsForRoom,
} from './fetch'
import {
    affordanceRowCacheKey,
    affordanceRowsCacheKey,
} from './keys'
import { isAuthoritativeAffordanceRow } from './guards'
import type { AffordanceCacheRow } from './types'

export type AffordanceCacheSetParams = {
    row: AffordanceCacheRow;
}

/**
 * Per-invocation read + memo handler for Ephemera affordance-topology rows (`Affordance::`).
 * Dynamo writes stay in the owning DataSource; memo APIs patch in-memory state only.
 */
export class AffordanceCacheCacheHandler {
    private readonly _AffordanceRowsCache: DeferredCache<AffordanceCacheRow[]>
    private readonly _AffordanceRowCache: DeferredCache<AffordanceCacheRow | undefined>

    private _AffordanceRowsStore: Record<string, AffordanceCacheRow[]> = {}
    private _AffordanceRowStore: Record<string, AffordanceCacheRow | undefined> = {}

    constructor(private readonly db: EphemeraAffordanceCacheReadDB) {
        //
        // Resolve the store lazily on every callback rather than capturing it once: `clear()` rebinds
        // these fields to fresh objects, so a captured reference would leave the DeferredCache writing
        // fetched rows into an orphaned store while reads saw a permanently empty one.
        //
        const storeCallback = <T>(getStore: () => Record<string, T>) => (key: string, value: T) => {
            getStore()[key] = value
        }

        this._AffordanceRowsCache = new DeferredCache<AffordanceCacheRow[]>({
            callback: storeCallback(() => this._AffordanceRowsStore),
        })
        this._AffordanceRowCache = new DeferredCache<AffordanceCacheRow | undefined>({
            callback: storeCallback(() => this._AffordanceRowStore),
        })
    }

    async queryAffordanceRows(roomId: EphemeraRoomId): Promise<AffordanceCacheRow[]> {
        const key = affordanceRowsCacheKey(roomId)
        if (!this._AffordanceRowsCache.isCached(key)) {
            this._AffordanceRowsCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, AffordanceCacheRow[]> = {}
                    await Promise.all(
                        keys.map(async (k) => {
                            const room = k.slice(0, k.indexOf('::affordanceRows'))
                            out[k] = await queryAffordanceRowsForRoom(this.db, room as EphemeraRoomId)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._AffordanceRowsCache.get(key)
        return this._AffordanceRowsStore[key] ?? []
    }

    private async loadAffordanceRowFromStore(
        roomId: EphemeraRoomId,
        perspectiveKey: string
    ): Promise<AffordanceCacheRow | undefined> {
        const key = affordanceRowCacheKey(roomId, perspectiveKey)
        if (!this._AffordanceRowCache.isCached(key)) {
            this._AffordanceRowCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, AffordanceCacheRow | undefined> = {}
                    await Promise.all(
                        keys.map(async (k) => {
                            const parts = k.split('::affordance::')
                            const room = parts[0]
                            const perspective = parts[1]
                            out[k] = await getAffordanceRowFromDynamo(
                                this.db,
                                room as EphemeraRoomId,
                                perspective
                            )
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._AffordanceRowCache.get(key)
        return this._AffordanceRowStore[key]
    }

    /**
     * Returns a hydrated affordance row for compose reads, or undefined when missing/stale.
     */
    async getAffordanceRow(
        roomId: EphemeraRoomId,
        perspectiveKey: string
    ): Promise<AffordanceCacheRow | undefined> {
        const row = await this.loadAffordanceRowFromStore(roomId, perspectiveKey)
        if (row === undefined || !isAuthoritativeAffordanceRow(row)) {
            return undefined
        }
        return row
    }

    /** Read including stale rows (catalog management / hydrate preflight). */
    async getAffordanceRowIncludingStale(
        roomId: EphemeraRoomId,
        perspectiveKey: string
    ): Promise<AffordanceCacheRow | undefined> {
        return this.loadAffordanceRowFromStore(roomId, perspectiveKey)
    }

    set(params: AffordanceCacheSetParams): void {
        const { row } = params
        const roomId = row.EphemeraId
        const rowsKey = affordanceRowsCacheKey(roomId)
        const rowKey = affordanceRowCacheKey(
            roomId,
            row.DataCategory.slice('Affordance::'.length)
        )

        let rows = this._AffordanceRowsStore[rowsKey]
        if (rows === undefined) {
            rows = []
            this._AffordanceRowsStore[rowsKey] = rows
            this._AffordanceRowsCache.set(Infinity, rowsKey, rows)
        }

        const index = rows.findIndex((r) => r.DataCategory === row.DataCategory)
        if (index >= 0) {
            rows[index] = row
        } else {
            rows.push(row)
        }

        this._AffordanceRowStore[rowKey] = row
        this._AffordanceRowCache.set(Infinity, rowKey, row)
    }

    invalidate(roomId: EphemeraRoomId): void {
        const rowsKey = affordanceRowsCacheKey(roomId)
        delete this._AffordanceRowsStore[rowsKey]
        this._AffordanceRowsCache.invalidate(rowsKey)

        const prefix = `${roomId}::affordance::`
        for (const key of Object.keys(this._AffordanceRowStore)) {
            if (key.startsWith(prefix)) {
                delete this._AffordanceRowStore[key]
                this._AffordanceRowCache.invalidate(key)
            }
        }
    }

    clear(): void {
        this._AffordanceRowsCache.clear()
        this._AffordanceRowCache.clear()
        this._AffordanceRowsStore = {}
        this._AffordanceRowStore = {}
    }

    async flush(): Promise<void> {
        await Promise.all([
            this._AffordanceRowsCache.flush(),
            this._AffordanceRowCache.flush(),
        ])
    }
}

export const createAffordanceCacheCacheHandler = (
    db: EphemeraAffordanceCacheReadDB
): AffordanceCacheCacheHandler => new AffordanceCacheCacheHandler(db)
