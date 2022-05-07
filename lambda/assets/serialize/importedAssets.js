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
            if (AssetId) {
                return {
                    [key]: AssetId
                }
            }
            return {}
        }
        const fetchPromises = Object.entries(importMap)
            .map(([key, { asset, scopedId }]) => (fetchScopeMap({ key, asset, scopedId: scopedId.key })))
        const promiseReturns = await Promise.all(fetchPromises)
        return Object.assign({}, ...promiseReturns)
    }

    const getImportTree = async (scopeMap) => {
        const assetsToFetch = [...(new Set(Object.values(importMap).map(({ asset }) => (asset))))]
        const fetchAssetImportTree = async (asset) => {
            const { importTree = {}, namespaceMap = {} } = await assetDB.getItem({
                AssetId: `ASSET#${asset}`,
                DataCategory: 'Meta::Asset',
                ProjectionFields: ['importTree', 'namespaceMap']
            })
            return {
                importTree: { [asset]: importTree },
                namespaceMap: { [asset]: namespaceMap }
            }
        }
        const fetchPromises = assetsToFetch.
            map((asset) => (fetchAssetImportTree(asset)))
        
        const promiseReturns = await Promise.all(fetchPromises)
        const importTree = Object.assign({}, ...promiseReturns.map(({ importTree }) => (importTree)))
        const namespaceMapByAssetId = Object.assign({}, ...promiseReturns.map(({ namespaceMap }) => (namespaceMap)))
        const namespaceMap = Object.assign({}, ...Object.entries(importMap)
            .map(([toKey, { asset: assetId, scopedId: { key: fromKey } }]) => {
                if (namespaceMapByAssetId[assetId]?.[fromKey]) {
                    return { [toKey]: namespaceMapByAssetId[assetId][fromKey] }
                }
                else {
                    return { [toKey]: {
                        key: `${assetId}#${fromKey}`,
                        assetId: scopeMap[fromKey]
                    } }
                }
            }))
        return {
            importTree,
            namespaceMap
        }
    }

    const scopeMap = await getScopeMap()
    const { importTree, namespaceMap } = await getImportTree(scopeMap)
    return {
        scopeMap,
        importTree,
        namespaceMap
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
