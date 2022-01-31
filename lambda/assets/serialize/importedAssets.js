import { QueryCommand } from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { splitType } from '../utilities/types.js'

const { TABLE_PREFIX } = process.env;
const assetsTable = `${TABLE_PREFIX}_assets`

export const importedAssetIds = async ({ dbClient }, importMap) => {
    const fetchPromises = Object.entries(importMap)
        .map(([key, { asset, scopedId }]) => (
            dbClient.send(new QueryCommand({
                TableName: assetsTable,
                IndexName: 'ScopedIdIndex',
                KeyConditionExpression: "DataCategory = :dc AND scopedId = :scopedId",
                ExpressionAttributeValues: marshall({
                    ":dc": `ASSET#${asset}`,
                    ":scopedId": scopedId
                }),
                ProjectionExpression: 'AssetId'
            }))
            .then(({ Items = [] }) => (
                Items.length > 0
                    ? { [key]: splitType(unmarshall(Items[0]).AssetId)[1] }
                    : {}
            ))
        ))
    const promiseReturns = await Promise.all(fetchPromises)
    return Object.assign({}, ...promiseReturns)
}
