import { v4 as uuidv4 } from 'uuid'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import type { EphemeraRenderCacheReadDB } from './fetch'
import {
    getCatalogRow as fetchCatalogRow,
    queryCacheRowsForComponent,
    queryCatalogRowsForComponent,
} from './fetch'
import {
    catalogRowCacheKey,
    catalogRowsCacheKey,
    EPHEMERA_CACHE_DATA_CATEGORY_PREFIX,
    perspectiveKeyFromCatalogDataCategory,
} from './keys'
import type {
    EphemeraCacheCatalogRow,
    EphemeraCacheComponentId,
    EphemeraCacheDynamoItem,
    EphemeraCacheMarkState,
    EphemeraCacheProvenance,
    EphemeraCacheRenderedContent,
    EphemeraPerspectiveId,
} from './types'
import type { PerspectiveMatcher } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { markStatesEqual } from './markState'

/** Fields to upsert into the in-memory array for `componentId`. */
export type RenderCacheSetParams = {
    componentId: EphemeraCacheComponentId;
    markState: EphemeraCacheMarkState;
    /** Dynamo DataCategory (`CACHE#...`). If omitted, match by `markState` or append with a new key. */
    cacheId?: string;
    renderedContent: EphemeraCacheRenderedContent;
    provenance: EphemeraCacheProvenance;
    perspectiveId: EphemeraPerspectiveId;
    perspectiveMatcher: PerspectiveMatcher;
    situationId?: EphemeraSituationId;
    catalogVersion?: number;
}

/** Memo-only patch for a `Cache::${perspectiveKey}` catalog row. */
export type RenderCacheSetCatalogRowParams = {
    row: EphemeraCacheCatalogRow;
}

const cacheRowsKey = (componentId: EphemeraCacheComponentId): string => componentId as string

/**
 * Per-invocation read + memo handler for Ephemera render-cache rows (`CACHE#` + `Cache::`).
 * Dynamo writes stay in the owning DataSource; memo APIs patch in-memory state only.
 */
export class RenderCacheCacheHandler {
    private readonly _CacheRowsCache: DeferredCache<EphemeraCacheDynamoItem[]>
    private readonly _CatalogRowsCache: DeferredCache<EphemeraCacheCatalogRow[]>
    private readonly _CatalogRowCache: DeferredCache<EphemeraCacheCatalogRow | undefined>

    private _CacheRowsStore: Record<string, EphemeraCacheDynamoItem[]> = {}
    private _CatalogRowsStore: Record<string, EphemeraCacheCatalogRow[]> = {}
    private _CatalogRowStore: Record<string, EphemeraCacheCatalogRow | undefined> = {}

    constructor(private readonly db: EphemeraRenderCacheReadDB) {
        //
        // Resolve the store lazily on every callback rather than capturing it once: `clear()` rebinds
        // these fields to fresh objects, so a captured reference would leave the DeferredCache writing
        // fetched rows into an orphaned store while `get*` read a permanently empty one.
        //
        const storeCallback = <T>(getStore: () => Record<string, T>) => (key: string, value: T) => {
            getStore()[key] = value
        }

        this._CacheRowsCache = new DeferredCache<EphemeraCacheDynamoItem[]>({
            callback: storeCallback(() => this._CacheRowsStore),
        })
        this._CatalogRowsCache = new DeferredCache<EphemeraCacheCatalogRow[]>({
            callback: storeCallback(() => this._CatalogRowsStore),
        })
        this._CatalogRowCache = new DeferredCache<EphemeraCacheCatalogRow | undefined>({
            callback: storeCallback(() => this._CatalogRowStore),
        })
    }

    async getCacheRows(componentId: EphemeraCacheComponentId): Promise<EphemeraCacheDynamoItem[]> {
        return this.get(componentId)
    }

    /** Alias for refactor compatibility. */
    async get(componentId: EphemeraCacheComponentId): Promise<EphemeraCacheDynamoItem[]> {
        const key = cacheRowsKey(componentId)
        if (!this._CacheRowsCache.isCached(key)) {
            this._CacheRowsCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraCacheDynamoItem[]> = {}
                    await Promise.all(
                        keys.map(async (k) => {
                            out[k] = await queryCacheRowsForComponent(this.db, k as EphemeraCacheComponentId)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._CacheRowsCache.get(key)
        return this._CacheRowsStore[key] ?? []
    }

    async getCatalogRows(componentId: EphemeraCacheComponentId): Promise<EphemeraCacheCatalogRow[]> {
        const key = catalogRowsCacheKey(componentId)
        if (!this._CatalogRowsCache.isCached(key)) {
            this._CatalogRowsCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraCacheCatalogRow[]> = {}
                    await Promise.all(
                        keys.map(async (k) => {
                            const component = k.slice(0, k.indexOf('::catalogRows'))
                            out[k] = await queryCatalogRowsForComponent(this.db, component as EphemeraCacheComponentId)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._CatalogRowsCache.get(key)
        return this._CatalogRowsStore[key] ?? []
    }

    async getCatalogRow(
        componentId: EphemeraCacheComponentId,
        perspectiveKey: string
    ): Promise<EphemeraCacheCatalogRow | undefined> {
        const key = catalogRowCacheKey(componentId, perspectiveKey)
        if (!this._CatalogRowCache.isCached(key)) {
            this._CatalogRowCache.add({
                promiseFactory: async (keys: string[]) => {
                    const out: Record<string, EphemeraCacheCatalogRow | undefined> = {}
                    await Promise.all(
                        keys.map(async (k) => {
                            const parts = k.split('::catalog::')
                            const component = parts[0]
                            const perspective = parts[1]
                            out[k] = await fetchCatalogRow(this.db, component as EphemeraCacheComponentId, perspective)
                        })
                    )
                    return out
                },
                requiredKeys: [key],
                transform: (out) => out,
            })
        }
        await this._CatalogRowCache.get(key)
        return this._CatalogRowStore[key]
    }

    set(params: RenderCacheSetParams): void {
        const { componentId, markState, cacheId, renderedContent, provenance, perspectiveId, perspectiveMatcher } = params
        const key = cacheRowsKey(componentId)

        if (cacheId !== undefined && !cacheId.startsWith(EPHEMERA_CACHE_DATA_CATEGORY_PREFIX)) {
            return
        }

        let rows = this._CacheRowsStore[key]
        if (rows === undefined) {
            rows = []
            this._CacheRowsCache.set(Infinity, key, rows)
            this._CacheRowsStore[key] = rows
        }

        const baseItem = {
            EphemeraId: componentId,
            markState,
            renderedContent,
            provenance,
            perspectiveId,
            perspectiveMatcher,
            ...(params.situationId !== undefined ? { situationId: params.situationId } : {}),
            ...(params.catalogVersion !== undefined ? { catalogVersion: params.catalogVersion } : {}),
        } satisfies Omit<EphemeraCacheDynamoItem, 'DataCategory'>

        if (cacheId !== undefined) {
            const index = rows.findIndex((r) => r.DataCategory === cacheId)
            const item: EphemeraCacheDynamoItem = { ...baseItem, DataCategory: cacheId }
            if (index >= 0) {
                rows[index] = item
            } else {
                rows.push(item)
            }
            return
        }

        const index = rows.findIndex((r) => markStatesEqual(r.markState, markState))
        const dataCategory =
            index >= 0
                ? rows[index].DataCategory
                : `${EPHEMERA_CACHE_DATA_CATEGORY_PREFIX}${uuidv4()}`
        const item: EphemeraCacheDynamoItem = { ...baseItem, DataCategory: dataCategory }
        if (index >= 0) {
            rows[index] = item
        } else {
            rows.push(item)
        }
    }

    setCatalogRow(params: RenderCacheSetCatalogRowParams): void {
        const { row } = params
        const componentId = row.EphemeraId
        const perspectiveKey = perspectiveKeyFromCatalogDataCategory(row.DataCategory)
        if (perspectiveKey === undefined) {
            return
        }

        const rowsKey = catalogRowsCacheKey(componentId)
        const rowKey = catalogRowCacheKey(componentId, perspectiveKey)

        let rows = this._CatalogRowsStore[rowsKey]
        if (rows === undefined) {
            rows = []
            this._CatalogRowsStore[rowsKey] = rows
            this._CatalogRowsCache.set(Infinity, rowsKey, rows)
        }

        const index = rows.findIndex((r) => r.DataCategory === row.DataCategory)
        if (index >= 0) {
            rows[index] = row
        } else {
            rows.push(row)
        }

        this._CatalogRowStore[rowKey] = row
        this._CatalogRowCache.set(Infinity, rowKey, row)
    }

    deleteCacheRecords(componentId: EphemeraCacheComponentId, cacheIds: string[]): void {
        const rows = this._CacheRowsStore[cacheRowsKey(componentId)]
        if (rows === undefined || !cacheIds.length) {
            return
        }

        const idSet = new Set(cacheIds)
        const next = rows.filter((r) => !idSet.has(r.DataCategory))
        if (next.length === rows.length) {
            return
        }
        rows.splice(0, rows.length, ...next)
    }

    invalidate(componentId: EphemeraCacheComponentId): void {
        const rowsKey = cacheRowsKey(componentId)
        delete this._CacheRowsStore[rowsKey]
        this._CacheRowsCache.invalidate(rowsKey)

        const listKey = catalogRowsCacheKey(componentId)
        delete this._CatalogRowsStore[listKey]
        this._CatalogRowsCache.invalidate(listKey)

        const prefix = `${componentId}::catalog::`
        for (const key of Object.keys(this._CatalogRowStore)) {
            if (key.startsWith(prefix)) {
                delete this._CatalogRowStore[key]
                this._CatalogRowCache.invalidate(key)
            }
        }
    }

    clear(): void {
        this._CacheRowsCache.clear()
        this._CatalogRowsCache.clear()
        this._CatalogRowCache.clear()
        this._CacheRowsStore = {}
        this._CatalogRowsStore = {}
        this._CatalogRowStore = {}
    }

    async flush(): Promise<void> {
        await Promise.all([
            this._CacheRowsCache.flush(),
            this._CatalogRowsCache.flush(),
            this._CatalogRowCache.flush(),
        ])
    }
}

export const createRenderCacheCacheHandler = (db: EphemeraRenderCacheReadDB): RenderCacheCacheHandler =>
    new RenderCacheCacheHandler(db)
