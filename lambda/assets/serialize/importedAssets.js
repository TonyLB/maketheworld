import { assetScopedIdQuery, assetGetItem } from "../utilities/dynamoDB/index.js"

import { splitType } from '../utilities/types.js'

export const importedAssetIds = async ({ dbClient }, importMap) => {
    const getScopeMap = async () => {
        const fetchScopeMap = async ({ key, asset, scopedId }) => {
            const Items = await assetScopedIdQuery({
                dbClient,
                ScopedId: scopedId,
                DataCategory: `ASSET#${asset}`
            })
            if (Items.length === 0) {
                return {}
            }
            const { AssetId } = Items[0]
            const translatedAssetId = splitType(AssetId || '')[1]
            if (translatedAssetId) {
                return {
                    [key]: translatedAssetId
                }
            }
            return {}
        }
        const fetchPromises = Object.entries(importMap)
            .map(([key, { asset, scopedId }]) => (fetchScopeMap({ key, asset, scopedId })))
        const promiseReturns = await Promise.all(fetchPromises)
        return Object.assign({}, ...promiseReturns)
    }

    const getImportTree = async () => {
        const assetsToFetch = [...(new Set(Object.values(importMap).map(({ asset }) => (asset))))]
        const fetchAssetImportTree = async (asset) => {
            const { ImportTree = {} } = await assetGetItem({
                dbClient,
                AssetId: `ASSET#${asset}`,
                DataCategory: 'Meta::Asset',
                ProjectionFields: ['ImportTree']
            })
            return { [asset]: ImportTree }
        }
        const fetchPromises = assetsToFetch.
            map((asset) => (fetchAssetImportTree(asset)))
        
        const promiseReturns = await Promise.all(fetchPromises)
        return Object.assign({}, ...promiseReturns)
    }

    const [ scopeMap, importTree ] = await Promise.all([ getScopeMap(), getImportTree() ])
    return {
        scopeMap,
        importTree
    }
}

const assetIdsFromTreeRecurse = (importTree) => {
    const returnValue = Object.entries(importTree)
        .map(([key, nested]) => ([key, ...assetIdsFromTreeRecurse(nested)]))
        .reduce((previous, list) => ([...previous, ...list]), [])
    return returnValue
}

export const assetIdsFromTree = (importTree) => {
    return [...(new Set(assetIdsFromTreeRecurse(importTree)))]
}
