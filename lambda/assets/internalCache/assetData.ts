import { isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { DeferredCache } from './deferredCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { isStandardNDJSONLine, StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'

type AssetDataCache = {
    AssetId: `ASSET#${string}`;
    standardForm: StandardForm;
}

export class AssetData {
    _Cache: DeferredCache<AssetDataCache>;
    
    constructor() {
        this._Cache = new DeferredCache<AssetDataCache>({
            defaultValue: (cacheKey) => {
                return {
                    AssetId: cacheKey as `ASSET#${string}`,
                    standardForm: new StandardForm(`<Asset key=(${cacheKey.split('#').slice(1)[0] ?? ''}) />`)
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

    async _getPromiseFactory(AssetIds: (`ASSET#${string}`)[]): Promise<AssetDataCache[]> {
        const queryResults = await Promise.all(
            AssetIds.map(async (AssetId) => {
                const ndjsonLines = (await assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
                    Key: { DataCategory: AssetId },
                    IndexName: 'DataCategoryIndex',
                    allFields: true
                })) || []
                const standardForm = new StandardForm([
                    { tag: 'Asset', key: AssetId.split('#').slice(1)[0], universalKey: AssetId },
                    ...ndjsonLines
                        .map(({ DataCategory, AssetId, ...line }) => (isSchemaComponentUUID(AssetId) ?
                            {
                                universalKey: AssetId,
                                ...line
                            }
                            : {}
                        ))
                        .filter(isStandardNDJSONLine)
                        .map((line) => ({
                            ...line,
                            _origin: [AssetId]
                        }))
                ])
                return {
                    AssetId,
                    standardForm
                }
            })
        )
        return queryResults
    }

    async get(AssetIds: (`ASSET#${string}`)[]): Promise<AssetDataCache[]> {
        this._Cache.add({
            promiseFactory: () => (this._getPromiseFactory(AssetIds)),
            requiredKeys: AssetIds,
            transform: (fetches) => {
                return Object.assign(
                    {},
                    ...(fetches.map((fetch) => ({
                        [fetch.AssetId]: {
                            AssetId: fetch.AssetId,
                            standardForm: fetch.standardForm
                        }
                    })))
                )
            }
        })
        return await Promise.all(AssetIds.map((AssetId) => (this._Cache.get(AssetId))))
    }

    invalidate(AssetId: `ASSET#${string}`) {
        if (AssetId in this._Cache) {
            this._Cache[AssetId].invalidate()
        }
    }

}
