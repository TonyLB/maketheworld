import { DeferredCache } from './deferredCache'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/index'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'
import { isAssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist'

type MetaCache = {
    address?: AssetWorkspaceAddress
}

export class MetaData {
    _Cache: DeferredCache<MetaCache>;
    
    constructor() {
        this._Cache = new DeferredCache<MetaCache>({
            defaultValue: (cacheKey) => {
                return {}
            }
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }

    async _getPromiseFactory(AssetId: `ASSET#${string}` | `CHARACTER#${string}`): Promise<MetaCache> {
        const { address } = (await assetDB.getItem<{ address: AssetWorkspaceAddress }>({
            Key: {
                AssetId,
                DataCategory: 'Meta::Asset'
            },
            ProjectionFields: ['address']
        })) || {}
        if (isAssetWorkspaceAddress(address)) {
            return {
                address
            }
        }
        return {}
    }

    async get(AssetId: `ASSET#${string}` | `CHARACTER#${string}`): Promise<MetaCache> {
        if (!this._Cache.isCached(AssetId)) {
            this._Cache.add({
                promiseFactory: () => (this._getPromiseFactory(AssetId)),
                requiredKeys: [AssetId],
                transform: (fetch) => {
                    if (typeof fetch === 'undefined') {
                        return {}
                    }
                    else {
                        return {
                            [AssetId]: fetch
                        }
                    }
                }
            })
        }
        return await this._Cache.get(AssetId)
    }

    invalidate(AssetId: `ASSET#${string}` | `CHARACTER#${string}`) {
        if (AssetId in this._Cache) {
            this._Cache[AssetId].invalidate()
        }
    }

}

export const Meta = <GBase extends CacheConstructor>(Base: GBase) => {
    return class Meta extends Base {
        Meta: MetaData;

        constructor(...rest: any) {
            super(...rest)
            this.Meta = new MetaData()
        }
        override clear() {
            this.Meta.clear()
            super.clear()
        }
    }
}

export default Meta
