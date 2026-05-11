import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { defaultStoredEntryForCacheKey } from './defaults'
import { fetchCachedAssetIdsForComponent, fetchComponentsForAssets, type ComponentAssetMetaAssetDB } from './fetch'
import { cacheKeyComponents, generateCacheKey } from './keys'

type EphemeraKeyMappingMixin = { EphemeraId: string }
type ComponentAssetMetaMixin = { assetId: string }

export type ComponentAssetMetaItem<T extends StandardComponentData = StandardComponentData> = T &
    EphemeraKeyMappingMixin &
    ComponentAssetMetaMixin

type CachedMetaRow = { assetId: AssetUUID; component: StandardComponent }

/**
 * Per-asset component meta reads for ephemera (`getItems` path). Distinct cache identity from assets
 * {@link AuthoritativeComponentDataCache}; see `packages/mtw-gateways/AGENT.md` (ephemera vs assets table).
 */
export class EphemeraComponentAssetMetaCache {
    readonly _Cache: DeferredCache<CachedMetaRow>
    private _Store: Record<string, CachedMetaRow> = {}

    constructor(private readonly assetDB: ComponentAssetMetaAssetDB) {
        this._Cache = new DeferredCache<CachedMetaRow>({
            callback: (key, value) => {
                this._Store[key] = value
            },
            defaultValue: (cacheKey) => defaultStoredEntryForCacheKey(cacheKey),
        })
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
        this._Store = {}
    }

    private fetchRowBatch(EphemeraId: ComponentUUID, assetIds: AssetUUID[]): Promise<CachedMetaRow[]> {
        return fetchComponentsForAssets(this.assetDB, EphemeraId, assetIds)
    }

    async get(EphemeraId: ComponentUUID, assetId: AssetUUID): Promise<CachedMetaRow> {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: () => this.fetchRowBatch(EphemeraId, [assetId]),
                requiredKeys: [cacheKey],
                transform: (fetch) => {
                    if (fetch.length === 0) {
                        return {}
                    }
                    return {
                        [cacheKey]: {
                            ...fetch[0],
                            assetId,
                        } as CachedMetaRow,
                    }
                },
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    async getAcrossAssets(EphemeraId: ComponentUUID, assetList: AssetUUID[]): Promise<Record<AssetUUID, StandardComponent>> {
        this._Cache.add({
            promiseFactory: (fetchNeeded) =>
                this.fetchRowBatch(
                    EphemeraId,
                    fetchNeeded.map((cacheKey) => cacheKeyComponents(cacheKey).assetId)
                ),
            requiredKeys: assetList.map((assetId) => generateCacheKey(EphemeraId, assetId)),
            transform: (fetchList) =>
                fetchList.reduce<Record<string, CachedMetaRow>>((previous, fetch) => {
                    if (typeof fetch !== 'undefined' && fetch.component.universalKey) {
                        return {
                            ...previous,
                            [generateCacheKey(fetch.component.universalKey, fetch.assetId)]: fetch,
                        }
                    }
                    return previous
                }, {}),
        })
        const individualMetas = await Promise.all(assetList.map((assetId) => this.get(EphemeraId, assetId)))
        return individualMetas.reduce<Record<AssetUUID, StandardComponent>>(
            (previous, item) => ({
                ...previous,
                [item.assetId]: item.component,
            }),
            {}
        )
    }

    async getAcrossAllAssets(EphemeraId: ComponentUUID): Promise<Record<AssetUUID, StandardComponent>> {
        const assetIds = await fetchCachedAssetIdsForComponent(this.assetDB, EphemeraId)
        return await this.getAcrossAssets(EphemeraId, assetIds)
    }

    invalidate(EphemeraId: ComponentUUID, assetId: AssetUUID): void {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        delete this._Store[cacheKey]
        this._Cache.invalidate(cacheKey)
    }

    set(EphemeraId: ComponentUUID, assetId: AssetUUID, value: StandardComponent): void {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        this._Cache.set(Infinity, cacheKey, { assetId, component: value })
        this._Store[cacheKey] = { assetId, component: value }
    }
}

export function createEphemeraComponentAssetMetaCacheHandler(
    assetDB: ComponentAssetMetaAssetDB
): EphemeraComponentAssetMetaCache {
    return new EphemeraComponentAssetMetaCache(assetDB)
}
