import { isSchemaComponentUUID } from '@tonylb/mtw-base/ts/schema'
import { DeferredCache } from '@tonylb/mtw-lambda-patterns/ts/internalCache'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { StandardForm } from '@tonylb/mtw-wml/ts/standardize'
import { isStandardNDJSONLine, StandardComponentData } from '@tonylb/mtw-wml/ts/standardize/baseClasses'
import { StandardReferenceData } from '@tonylb/mtw-wml/ts/standardize/keys/dataTypes/reference'

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
                    standardForm: new StandardForm(`<Asset uuid=(${cacheKey.split('#').slice(1)[0] ?? ''}) />`)
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
                const [ndjsonLines, assetMeta] = await Promise.all([
                    assetDB.query<StandardComponentData & { AssetId: string; DataCategory: string }>({
                        Key: { DataCategory: AssetId },
                        IndexName: 'DataCategoryIndex',
                        allFields: true
                    }).then((lines) => lines || []),
                    assetDB.getItem<{ shortName?: string; summary?: any[]; topLevel?: StandardReferenceData[] }>({
                        Key: {
                            AssetId,
                            DataCategory: 'Meta::Asset'
                        },
                        ProjectionFields: ['shortName', 'summary', 'topLevel']
                    })
                ])
                
                // Build Asset header with metadata from Meta::Asset record
                const assetHeader: any = {
                    tag: 'Asset',
                    key: AssetId.split('#').slice(1)[0],
                    universalKey: AssetId
                }
                // Include Asset-level metadata if present (following omission-over-empty principle)
                if (assetMeta?.shortName) {
                    assetHeader.shortName = assetMeta.shortName
                }
                if (assetMeta?.summary) {
                    assetHeader.summary = assetMeta.summary
                }
                if (assetMeta?.topLevel) {
                    assetHeader.topLevel = assetMeta.topLevel
                }
                
                const standardForm = new StandardForm([
                    assetHeader,
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
