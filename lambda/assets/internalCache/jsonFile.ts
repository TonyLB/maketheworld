import { DeferredCache } from './deferredCache'
import { NormalForm } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import AssetWorkspace, { AssetWorkspaceAddress, NamespaceMapping } from '@tonylb/mtw-asset-workspace/dist/index'
import Meta, { MetaData } from './meta'
import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/dist/baseClasses'

type JSONFileCache = {
    normal: NormalForm;
    namespaceIdToDB: NamespaceMapping;
}

export class JSONFileData {
    _Meta: (key: EphemeraAssetId | EphemeraCharacterId) => Promise<{ address?: AssetWorkspaceAddress }>;
    _Cache: DeferredCache<JSONFileCache>;
    
    constructor(meta: MetaData) {
        this._Meta = (key: EphemeraAssetId | EphemeraCharacterId) => (meta.get(key))
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
        const { address } = await this._Meta(AssetId)
        if (!address) {
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

export const JSONFile = <GBase extends ReturnType<typeof Meta>>(Base: GBase) => {
    return class JSONFile extends Base {
        JSONFile: JSONFileData;

        constructor(...rest: any) {
            super(...rest)
            this.JSONFile = new JSONFileData(this.Meta)
        }
        override clear() {
            this.JSONFile.clear()
            super.clear()
        }
    }
}

export default JSONFile
