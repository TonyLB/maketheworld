import { EphemeraId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    queryImportVerticalMeta,
    type ImportVerticalHop,
} from '@tonylb/mtw-gateways/ts/assets/components/verticals'

// Meta::Import vertical envelope per universal component id; shared read path via @tonylb/mtw-gateways (see packages/mtw-gateways/AGENT.md).

type ComponentVerticalsCache = {
    universalKey: EphemeraId
    hops: ImportVerticalHop[]
}

export class ComponentVerticals {
    _Cache: DeferredCache<ComponentVerticalsCache>

    constructor() {
        this._Cache = new DeferredCache<ComponentVerticalsCache>({
            defaultValue: (cacheKey) => ({
                universalKey: cacheKey as EphemeraId,
                hops: [],
            }),
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }

    async _getPromiseFactory(universalKeys: EphemeraId[]): Promise<ComponentVerticalsCache[]> {
        return Promise.all(
            universalKeys.map(async (universalKey) => {
                const hops = await queryImportVerticalMeta(assetDB, universalKey)
                return { universalKey, hops }
            })
        )
    }

    async get(universalKeys: EphemeraId[]): Promise<ComponentVerticalsCache[]> {
        this._Cache.add({
            promiseFactory: () => this._getPromiseFactory(universalKeys),
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

    invalidate(universalKey: EphemeraId) {
        this._Cache.invalidate(universalKey)
    }
}
