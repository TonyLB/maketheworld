import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'
import type { StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

import { authoritativeComponentDataFromUniversalPartitionRows } from './dynamoStandardComponents'

/**
 * Narrow `assetDB` slice for universal-key partition `Query` (assets lambda `ComponentData` path).
 */
export type AuthoritativeComponentPartitionAssetDB = {
    query: <T extends StandardComponentData & { AssetId: string; DataCategory: string }>(props: {
        Key: { AssetId: string }
        allFields: true
    }) => Promise<T[] | undefined>
}

type ComponentDataCacheEntry = {
    ComponentId: EphemeraId
    byAssets: {
        AssetId: `ASSET#${string}`
        component: StandardComponent
    }[]
}

/**
 * `DeferredCache` over authoritative component rows per universal id (partition `Query`), matching
 * assets `internalCache.ComponentData` behavior.
 */
export class AuthoritativeComponentDataCache {
    readonly _Cache: DeferredCache<ComponentDataCacheEntry>

    constructor(private readonly assetDB: AuthoritativeComponentPartitionAssetDB) {
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
        return Promise.all(
            ComponentIds.map(async (ComponentId) => {
                const ndjsonLines =
                    (await this.assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
                        Key: { AssetId: ComponentId },
                        allFields: true,
                    })) || []
                return authoritativeComponentDataFromUniversalPartitionRows(ComponentId, ndjsonLines)
            })
        )
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

export function createAuthoritativeComponentDataCacheHandler(
    assetDB: AuthoritativeComponentPartitionAssetDB
): AuthoritativeComponentDataCache {
    return new AuthoritativeComponentDataCache(assetDB)
}
