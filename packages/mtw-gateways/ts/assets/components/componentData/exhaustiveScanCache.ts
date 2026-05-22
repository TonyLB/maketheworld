import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

import { exhaustiveComponentPartitionScan, type ExhaustivePartitionAssetDB } from './exhaustiveScan'

type ComponentDataCacheEntry = {
    ComponentId: EphemeraId
    byAssets: {
        AssetId: `ASSET#${string}`
        component: StandardComponent
    }[]
}

/**
 * Module-local `DeferredCache` over {@link exhaustiveComponentPartitionScan}.
 * Maintenance/diagnostics whitelist only --- not registered on lambda `internalCache`.
 */
export class ExhaustiveScanCache {
    readonly _Cache: DeferredCache<ComponentDataCacheEntry>

    constructor(private readonly assetDB: ExhaustivePartitionAssetDB) {
        this._Cache = new DeferredCache<ComponentDataCacheEntry>({
            defaultValue: (cacheKey) => ({
                ComponentId: cacheKey as EphemeraId,
                byAssets: [],
            }),
        })
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
    }

    private async loadPartitions(ComponentIds: EphemeraId[]): Promise<ComponentDataCacheEntry[]> {
        return Promise.all(ComponentIds.map((id) => exhaustiveComponentPartitionScan(this.assetDB, id)))
    }

    async get(ComponentIds: EphemeraId[]): Promise<ComponentDataCacheEntry[]> {
        this._Cache.add({
            promiseFactory: () => this.loadPartitions(ComponentIds),
            requiredKeys: ComponentIds,
            transform: (fetches) =>
                Object.assign(
                    {},
                    ...fetches.map((fetch) => ({
                        [fetch.ComponentId]: {
                            ComponentId: fetch.ComponentId,
                            byAssets: fetch.byAssets,
                        },
                    }))
                ),
        })
        return await Promise.all(ComponentIds.map((id) => this._Cache.get(id)))
    }

    invalidate(ComponentId: EphemeraId): void {
        this._Cache.invalidate(ComponentId)
    }
}

export function createExhaustiveScanCacheHandler(assetDB: ExhaustivePartitionAssetDB): ExhaustiveScanCache {
    return new ExhaustiveScanCache(assetDB)
}
