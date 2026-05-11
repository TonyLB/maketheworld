import type { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'

import { queryImportVerticalMeta, type ImportVerticalAssetDB, type ImportVerticalHop } from './fetch'

type ComponentVerticalsCacheEntry = {
    universalKey: EphemeraId
    hops: ImportVerticalHop[]
}

/**
 * `DeferredCache` over `Meta::Import::...` hops per universal component id (assets `internalCache.ComponentVerticals`).
 */
export class ImportVerticalMetaCache {
    readonly _Cache: DeferredCache<ComponentVerticalsCacheEntry>

    constructor(private readonly assetDB: ImportVerticalAssetDB) {
        this._Cache = new DeferredCache<ComponentVerticalsCacheEntry>({
            defaultValue: (cacheKey) => ({
                universalKey: cacheKey as EphemeraId,
                hops: [],
            }),
        })
    }

    async flush(): Promise<void> {
        await this._Cache.flush()
    }

    clear(): void {
        this._Cache.clear()
    }

    private async loadHops(universalKeys: EphemeraId[]): Promise<ComponentVerticalsCacheEntry[]> {
        return Promise.all(
            universalKeys.map(async (universalKey) => {
                const hops = await queryImportVerticalMeta(this.assetDB, universalKey)
                return { universalKey, hops }
            })
        )
    }

    async get(universalKeys: EphemeraId[]): Promise<ComponentVerticalsCacheEntry[]> {
        this._Cache.add({
            promiseFactory: () => this.loadHops(universalKeys),
            requiredKeys: universalKeys,
            transform: (fetches) =>
                Object.assign(
                    {},
                    ...fetches.map((fetch) => ({
                        [fetch.universalKey]: {
                            universalKey: fetch.universalKey,
                            hops: fetch.hops,
                        },
                    }))
                ),
        })
        return await Promise.all(universalKeys.map((id) => this._Cache.get(id)))
    }

    invalidate(universalKey: EphemeraId): void {
        this._Cache.invalidate(universalKey)
    }
}

export function createImportVerticalMetaCacheHandler(assetDB: ImportVerticalAssetDB): ImportVerticalMetaCache {
    return new ImportVerticalMetaCache(assetDB)
}
