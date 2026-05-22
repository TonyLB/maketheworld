import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { defaultStoredEntryForCacheKey } from './defaults'
import { fetchComponentsForAssets, type ComponentAssetMetaAssetDB } from './fetch'
import {
    cacheKeyComponents,
    componentPairCacheKey,
    type ComponentAssetPair,
} from './keys'

type CachedPairRow = { assetId: AssetUUID; component: StandardComponent }

export type ComponentPairRow = {
    universalKey: ComponentUUID
    assetId: AssetUUID
    component: StandardComponent
}

type EphemeraKeyMappingMixin = { EphemeraId: string }
type ComponentAssetMetaMixin = { assetId: string }

export type ComponentAssetMetaItem<T extends StandardComponentData = StandardComponentData> = T &
    EphemeraKeyMappingMixin &
    ComponentAssetMetaMixin

/**
 * Pair-addressed tier-1 cache (`getItems` path). Normative runtime reads for component bodies;
 * see `packages/mtw-gateways/AGENT.md` (Component data read surfaces).
 */
export class ComponentDataCache {
    readonly _Cache: DeferredCache<CachedPairRow>
    private _Store: Record<string, CachedPairRow> = {}

    constructor(private readonly assetDB: ComponentAssetMetaAssetDB) {
        this._Cache = new DeferredCache<CachedPairRow>({
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

    private fetchRowBatch(universalKey: ComponentUUID, assetIds: AssetUUID[]): Promise<CachedPairRow[]> {
        return fetchComponentsForAssets(this.assetDB, universalKey, assetIds)
    }

    private async ensurePairCached(universalKey: ComponentUUID, assetId: AssetUUID): Promise<CachedPairRow> {
        const cacheKey = componentPairCacheKey(universalKey, assetId)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: () => this.fetchRowBatch(universalKey, [assetId]),
                requiredKeys: [cacheKey],
                transform: (fetch) => {
                    if (fetch.length === 0) {
                        return {}
                    }
                    return {
                        [cacheKey]: {
                            ...fetch[0],
                            assetId,
                        } as CachedPairRow,
                    }
                },
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    /** Single pair read (ephemera ergonomics). */
    async get(universalKey: ComponentUUID, assetId: AssetUUID): Promise<CachedPairRow> {
        return this.ensurePairCached(universalKey, assetId)
    }

    /**
     * Batch pair read; groups fetches by universal key to avoid N+1 `getItems` calls.
     */
    async getPairs(pairs: readonly ComponentAssetPair[]): Promise<readonly ComponentPairRow[]> {
        if (pairs.length === 0) {
            return []
        }

        const uncachedByUniversal = new Map<ComponentUUID, AssetUUID[]>()
        for (const { universalKey, assetId } of pairs) {
            const cacheKey = componentPairCacheKey(universalKey, assetId)
            if (!this._Cache.isCached(cacheKey)) {
                const list = uncachedByUniversal.get(universalKey) ?? []
                list.push(assetId)
                uncachedByUniversal.set(universalKey, list)
            }
        }

        for (const [universalKey, assetIds] of uncachedByUniversal) {
            const requiredKeys = assetIds.map((assetId) => componentPairCacheKey(universalKey, assetId))
            this._Cache.add({
                promiseFactory: () => this.fetchRowBatch(universalKey, assetIds),
                requiredKeys,
                transform: (fetchList) =>
                    fetchList.reduce<Record<string, CachedPairRow>>((previous, fetch) => {
                        if (typeof fetch !== 'undefined' && fetch.component.universalKey) {
                            return {
                                ...previous,
                                [componentPairCacheKey(fetch.component.universalKey, fetch.assetId)]: fetch,
                            }
                        }
                        return previous
                    }, {}),
            })
        }

        return Promise.all(
            pairs.map(async ({ universalKey, assetId }) => {
                const row = await this.ensurePairCached(universalKey, assetId)
                return {
                    universalKey,
                    assetId: row.assetId,
                    component: row.component,
                }
            })
        )
    }

    async getAcrossAssets(
        universalKey: ComponentUUID,
        assetList: AssetUUID[]
    ): Promise<Record<AssetUUID, StandardComponent>> {
        this._Cache.add({
            promiseFactory: (fetchNeeded) =>
                this.fetchRowBatch(
                    universalKey,
                    fetchNeeded.map((cacheKey) => cacheKeyComponents(cacheKey).assetId)
                ),
            requiredKeys: assetList.map((assetId) => componentPairCacheKey(universalKey, assetId)),
            transform: (fetchList) =>
                fetchList.reduce<Record<string, CachedPairRow>>((previous, fetch) => {
                    if (typeof fetch !== 'undefined' && fetch.component.universalKey) {
                        return {
                            ...previous,
                            [componentPairCacheKey(fetch.component.universalKey, fetch.assetId)]: fetch,
                        }
                    }
                    return previous
                }, {}),
        })
        const individualMetas = await Promise.all(assetList.map((assetId) => this.get(universalKey, assetId)))
        return individualMetas.reduce<Record<AssetUUID, StandardComponent>>(
            (previous, item) => ({
                ...previous,
                [item.assetId]: item.component,
            }),
            {}
        )
    }

    invalidate(universalKey: ComponentUUID, assetId: AssetUUID): void {
        const cacheKey = componentPairCacheKey(universalKey, assetId)
        delete this._Store[cacheKey]
        this._Cache.invalidate(cacheKey)
    }

    invalidatePairKey(pairKey: string): void {
        const { EphemeraId, assetId } = cacheKeyComponents(pairKey)
        this.invalidate(EphemeraId, assetId)
    }

    set(universalKey: ComponentUUID, assetId: AssetUUID, value: StandardComponent): void {
        const cacheKey = componentPairCacheKey(universalKey, assetId)
        this._Cache.set(Infinity, cacheKey, { assetId, component: value })
        this._Store[cacheKey] = { assetId, component: value }
    }
}

export function createComponentDataCacheHandler(assetDB: ComponentAssetMetaAssetDB): ComponentDataCache {
    return new ComponentDataCache(assetDB)
}
