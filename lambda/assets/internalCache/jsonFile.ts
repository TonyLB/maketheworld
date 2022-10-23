import { DeferredCache } from './deferredCache'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetWorkspace, { isAssetWorkspaceAddress, NamespaceMapping } from '@tonylb/mtw-asset-workspace'
import { assetDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

type JSONFileCache = {
    normal: NormalForm;
    namespaceIdToDB: NamespaceMapping;
}

export class JSONFileData {
    _Cache: DeferredCache<JSONFileCache>;
    
    constructor() {
        this._Cache = new DeferredCache<JSONFileCache>({
            defaultValue: (cacheKey) => {
                return {
                    normal: {},
                    namespaceIdToDB: {}
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

    async _getPromiseFactory(AssetId: `ASSET#${string}`): Promise<JSONFileCache> {
        const address = await assetDB.getItem<{ zone: string; player?: string; subFolder?: string; fileName: string }>({
            AssetId,
            DataCategory: 'Meta::Asset',
            ProjectionFields: ['#zone', 'player', 'subFolder', 'fileName'],
            ExpressionAttributeNames: {
                '#zone': 'zone'
            }
        })
        if (!isAssetWorkspaceAddress(address)) {
            return {
                normal: {},
                namespaceIdToDB: {}
            }
        }
        const assetWorkspace = new AssetWorkspace(address)
        await assetWorkspace.loadJSON()
        return {
            normal: assetWorkspace.normal || {},
            namespaceIdToDB: assetWorkspace.namespaceIdToDB || {}
        }
    }

    async get(AssetId: `ASSET#${string}`): Promise<JSONFileCache> {
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

    invalidate(AssetId: `ASSET#${string}`) {
        if (AssetId in this._Cache) {
            this._Cache[AssetId].invalidate()
        }
    }

}

export const JSONFile = <GBase extends CacheConstructor>(Base: GBase) => {
    return class JSONFile extends Base {
        JSONFile: JSONFileData;

        constructor(...rest: any) {
            super(...rest)
            this.JSONFile = new JSONFileData()
        }
        override clear() {
            this.JSONFile.clear()
            super.clear()
        }
    }
}

export default JSONFile
