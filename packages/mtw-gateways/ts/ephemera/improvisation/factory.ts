import type { AssetUUID, ComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { defaultStoredEntryForCacheKey } from '../../assets/components/componentData/defaults'
import type { ComponentAcrossAssetsEntry, ComponentPairRow } from '../../assets/components/componentData/componentDataCache'
import {
    cacheKeyComponents,
    componentPairCacheKey,
    type ComponentAssetPair,
} from '../../assets/components/componentData/keys'
import type { PersistedReferencedByEntry } from '../../assets/components/componentData/referencedBy'

import { fetchImprovisationComponentsForAssets, type EphemeraImprovisationReadDB } from './fetch'
import { assertImprovisationAssetId } from './keys'

type CachedPairRow = ComponentAcrossAssetsEntry & { assetId: AssetUUID }

/**
 * Pair-addressed read + memo handler for ephemeraDB improvisation rows
 * `(OBJECT#, ASSET#IMPROVISATION)`. Dynamo writes stay in objects persistence; memo APIs patch in-memory state only.
 */
export class ImprovisationComponentDataCache {
    readonly _Cache: DeferredCache<CachedPairRow>
    private _Store: Record<string, CachedPairRow> = {}

    constructor(private readonly db: EphemeraImprovisationReadDB) {
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
        for (const assetId of assetIds) {
            assertImprovisationAssetId(assetId)
        }
        return fetchImprovisationComponentsForAssets(this.db, universalKey, assetIds)
    }

    private async ensurePairCached(universalKey: ComponentUUID, assetId: AssetUUID): Promise<CachedPairRow> {
        assertImprovisationAssetId(assetId)
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

    async get(universalKey: ComponentUUID, assetId: AssetUUID): Promise<CachedPairRow> {
        return this.ensurePairCached(universalKey, assetId)
    }

    async getPairs(pairs: readonly ComponentAssetPair[]): Promise<readonly ComponentPairRow[]> {
        if (pairs.length === 0) {
            return []
        }

        const uncachedByUniversal = new Map<ComponentUUID, AssetUUID[]>()
        for (const { universalKey, assetId } of pairs) {
            assertImprovisationAssetId(assetId)
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
                    ...(row.referencedBy ? { referencedBy: row.referencedBy } : {}),
                }
            })
        )
    }

    async getAcrossAssets(
        universalKey: ComponentUUID,
        assetList: AssetUUID[]
    ): Promise<Record<AssetUUID, ComponentAcrossAssetsEntry>> {
        for (const assetId of assetList) {
            assertImprovisationAssetId(assetId)
        }
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
        return individualMetas.reduce<Record<AssetUUID, ComponentAcrossAssetsEntry>>(
            (previous, item) => ({
                ...previous,
                [item.assetId]: {
                    component: item.component,
                    ...(item.referencedBy ? { referencedBy: item.referencedBy as PersistedReferencedByEntry[] } : {}),
                },
            }),
            {}
        )
    }

    invalidate(universalKey: ComponentUUID, assetId: AssetUUID): void {
        assertImprovisationAssetId(assetId)
        const cacheKey = componentPairCacheKey(universalKey, assetId)
        delete this._Store[cacheKey]
        this._Cache.invalidate(cacheKey)
    }

    set(universalKey: ComponentUUID, assetId: AssetUUID, value: StandardComponent): void {
        assertImprovisationAssetId(assetId)
        const cacheKey = componentPairCacheKey(universalKey, assetId)
        const row: CachedPairRow = { assetId, component: value }
        this._Cache.set(Infinity, cacheKey, row)
        this._Store[cacheKey] = row
    }
}

export function createImprovisationComponentDataCacheHandler(
    db: EphemeraImprovisationReadDB
): ImprovisationComponentDataCache {
    return new ImprovisationComponentDataCache(db)
}
