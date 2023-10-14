import { DeferredCache } from './deferredCache'
import { isAssetWorkspaceAddress, AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/dist/readOnly'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

type MetaCache = {
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    address?: AssetWorkspaceAddress;
}

export class MetaData {
    _Cache: DeferredCache<MetaCache>;
    
    constructor() {
        this._Cache = new DeferredCache<MetaCache>({
            defaultValue: (cacheKey) => {
                return {
                    AssetId: cacheKey as `ASSET#${string}` | `CHARACTER#${string}`
                }
            }
        })
    }

    async flush() {
        this._Cache.flush()
    }

    clear() {
        this._Cache.clear()
    }

    async _getPromiseFactory(AssetIds: (`ASSET#${string}` | `CHARACTER#${string}`)[]): Promise<MetaCache[]> {
        const addresses = (await assetDB.getItems<MetaCache>({
            Keys: AssetIds.map((AssetId) => ({
                AssetId,
                DataCategory: 'Meta::Asset'
            })),
            ProjectionFields: ['AssetId', 'address']
        })) || []
        return addresses.filter(({ address }) => (isAssetWorkspaceAddress(address)))
    }

    async get(AssetIds: (`ASSET#${string}` | `CHARACTER#${string}`)[]): Promise<MetaCache[]> {
        this._Cache.add({
            promiseFactory: () => (this._getPromiseFactory(AssetIds)),
            requiredKeys: AssetIds,
            transform: (fetches) => {
                return Object.assign(
                    {},
                    ...(fetches.map((fetch) => ({
                        [fetch.AssetId]: {
                            AssetId: fetch.AssetId,
                            address: fetch.address
                        }
                    })))
                )
            }
        })
        return await Promise.all(AssetIds.map((AssetId) => (this._Cache.get(AssetId))))
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
