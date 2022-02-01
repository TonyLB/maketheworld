import { GetItemCommand, QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { splitType } from '../utilities/types.js'

const { TABLE_PREFIX } = process.env;
const assetsTable = `${TABLE_PREFIX}_assets`

export const importedAssetIds = async ({ dbClient }, importMap) => {
    const getScopeMap = async () => {
        const fetchScopeMap = async ({ key, asset, scopedId }) => {
            const { Items = [] } = await dbClient.send(new QueryCommand({
                TableName: assetsTable,
                IndexName: 'ScopedIdIndex',
                KeyConditionExpression: "DataCategory = :dc AND scopedId = :scopedId",
                ExpressionAttributeValues: marshall({
                    ":dc": `ASSET#${asset}`,
                    ":scopedId": scopedId
                }),
                ProjectionExpression: 'AssetId'
            }))
            if (Items.length === 0) {
                return {}
            }
            const { AssetId } = unmarshall(Items[0])
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
            try {
                const { Item } = await dbClient.send(new GetItemCommand({
                        TableName: assetsTable,
                        Key: marshall({
                            AssetId: `ASSET#${asset}`,
                            DataCategory: 'Meta::Asset'
                        }),
                        ProjectionExpression: 'ImportTree'
                    }))
                const { ImportTree = {} } = unmarshall(Item)
                return { [asset]: ImportTree }
            }
            catch {
                return {}
            }
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
