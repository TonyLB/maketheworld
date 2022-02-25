import { assetDB } from "/opt/utilities/dynamoDB/index.js"

import { splitType } from '/opt/utilities/types.js'

export const importedAssetIds = async (importMap) => {
    const getScopeMap = async () => {
        const fetchScopeMap = async ({ key, asset, scopedId }) => {
            const Items = await assetDB.query({
                IndexName: 'ScopedIdIndex',
                scopedId,
                KeyConditionExpression: 'DataCategory = :dc',
                ExpressionAttributeValues: {
                    ':dc': `ASSET#${asset}`
                }
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
            const { importTree = {} } = await assetDB.getItem({
                AssetId: `ASSET#${asset}`,
                DataCategory: 'Meta::Asset',
                ProjectionFields: ['importTree']
            })
            return { [asset]: importTree }
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

const assetIdsFromTreeRecurse = (tree) => {
    const returnValue = Object.entries(tree)
        .map(([key, nested]) => ([key, ...assetIdsFromTreeRecurse(nested)]))
        .reduce((previous, list) => ([...previous, ...list]), [])
    return returnValue
}

export const assetIdsFromTree = (importTree) => {
    return assetIdsFromTreeRecurse(importTree)
        .reduce((previous, key) => {
            if (previous.includes(key)) {
                return previous
            }
            return [
                ...previous,
                key
            ]
        }, [])
}
