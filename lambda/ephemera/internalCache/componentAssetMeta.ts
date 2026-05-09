import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import {
    generateCacheKey,
    cacheKeyComponents,
    defaultStoredEntryForCacheKey,
    fetchComponentsForAssets,
    fetchCachedAssetIdsForComponent,
} from '@tonylb/mtw-gateways/ts/assets/components/assetMeta'

// Recreated types from deleted cacheAsset/baseClasses
type EphemeraKeyMappingMixin = { EphemeraId: string }
import { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses';
import { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema';
import { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses';

type ComponentAssetMetaMixin = { assetId: string }
export type ComponentAssetMetaItem<T extends StandardComponentData = StandardComponentData> = T & EphemeraKeyMappingMixin & ComponentAssetMetaMixin

export class ComponentAssetMetaData {
    _Cache: DeferredCache<{ assetId: AssetUUID; component: StandardComponent }>;
    _Store: Record<string, { assetId: AssetUUID; component: StandardComponent }> = {}
    
    constructor() {
        this._Cache = new DeferredCache<{ assetId: AssetUUID; component: StandardComponent }>({
            callback: (key, value) => { this._setStore(key, value) },
            defaultValue: (cacheKey) => defaultStoredEntryForCacheKey(cacheKey)
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
        this._Store = {}
    }

    _setStore(key: string, value: { assetId: AssetUUID; component: StandardComponent }): void {
        this._Store[key] = value
    }

    _getPromiseFactory(EphemeraId: ComponentUUID, assetIds: AssetUUID[]): Promise<{ assetId: AssetUUID; component: StandardComponent }[]> {
        return fetchComponentsForAssets(assetDB, EphemeraId, assetIds)
    }

    async get(EphemeraId: ComponentUUID, assetId: AssetUUID): Promise<{ assetId: AssetUUID; component: StandardComponent }> {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (!this._Cache.isCached(cacheKey)) {
            this._Cache.add({
                promiseFactory: () => (this._getPromiseFactory(EphemeraId, [assetId])),
                requiredKeys: [cacheKey],
                transform: (fetch) => {
                    if (fetch.length === 0) {
                        return {}
                    }
                    else {
                        return {
                            [cacheKey]: {
                                ...fetch[0],
                                assetId,
                            } as { assetId: AssetUUID; component: StandardComponent }
                        }
                    }
                }
            })
        }
        await this._Cache.get(cacheKey)
        return this._Store[cacheKey]
    }

    async getAcrossAssets(EphemeraId: ComponentUUID, assetList: AssetUUID[]): Promise<Record<AssetUUID, StandardComponent>> {
        this._Cache.add({
            promiseFactory: (fetchNeeded) => (this._getPromiseFactory(EphemeraId, fetchNeeded.map((cacheKey) => (cacheKeyComponents(cacheKey).assetId)))),
            requiredKeys: assetList.map((assetId) => (generateCacheKey(EphemeraId, assetId))),
            transform: (fetchList) => {
                return fetchList.reduce<Record<string, { assetId: AssetUUID; component: StandardComponent }>>((previous, fetch) => {
                    if (typeof fetch !== 'undefined' && fetch.component.universalKey) {
                        return {
                            ...previous,
                            [generateCacheKey(fetch.component.universalKey, fetch.assetId)]: fetch
                        }
                    }
                    return previous
                }, {})
            }
        })
        const individualMetas = await Promise.all(assetList.map((assetId) => (this.get(EphemeraId, assetId))))
        return individualMetas.reduce<Record<AssetUUID, StandardComponent>>((previous, item) => ({
            ...previous,
            [item.assetId]: item.component
        }), {})

    }

    async getAcrossAllAssets(EphemeraId: ComponentUUID): Promise<Record<AssetUUID, StandardComponent>> {
        const assetIds = await fetchCachedAssetIdsForComponent(assetDB, EphemeraId)
        return await this.getAcrossAssets(EphemeraId, assetIds)
    }

    invalidate(EphemeraId: ComponentUUID, assetId: AssetUUID) {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        if (cacheKey in this._Store) {
            delete this._Store[cacheKey]
        }
        if (cacheKey in this._Cache) {
            delete this._Cache[cacheKey]
        }
    }

    set(EphemeraId: ComponentUUID, assetId: AssetUUID, value: StandardComponent) {
        const cacheKey = generateCacheKey(EphemeraId, assetId)
        this._Cache.set(Infinity, cacheKey, { assetId, component: value })
        this._Store[cacheKey] = { assetId, component: value }
    }
}

export default ComponentAssetMetaData
