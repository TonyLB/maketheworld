import {
    GetItemCommand,
    UpdateItemCommand,
    PutItemCommand,
    DeleteItemCommand,
    QueryCommand,
    BatchWriteItemCommand,
    BatchGetItemCommand
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { asyncSuppressExceptions } from '../errors.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`

export const batchWriteDispatcher = (dbClient, { table, items }) => {
    const groupBatches = items
        .reduce((({ current, requestLists }, item) => {
            if (current.length > 19) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .filter((itemList) => (itemList.length))
        .map((itemList) => (dbClient.send(new BatchWriteItemCommand({ RequestItems: {
            [table]: itemList
        } }))))
    return Promise.all(batchPromises)
}

export const batchGetDispatcher = (dbClient, { table, items, projectionExpression }) => {
    const groupBatches = items
        .reduce((({ current, requestLists }, item) => {
            if (current.length > 39) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .filter((itemList) => (itemList.length))
        .map((itemList) => (dbClient.send(new BatchGetItemCommand({ RequestItems: {
            [table]: {
                Keys: itemList,
                ProjectionExpression: projectionExpression
            }
        } }))))
    return Promise.all(batchPromises)
        .then((outcomes) => (outcomes.reduce((previous, { Items = [] }) => ([
            ...previous,
            ...Items.map(unmarshall)
        ]), [])))
}

//
// TODO:  Error handling to respond if the DynamoDB service throws an error
//
export const replaceItem = async (dbClient, item) => {
    const putItem = new PutItemCommand({
        TableName: assetsTable,
        Item: marshall(item, { removeUndefinedValues: true })
    })
    await dbClient.send(putItem)
}

//
// mergeIntoDataRange queries a given data search (either using the primary sort if Asset/EphemeraId is
// specified in the search, or the DataCategory index if DataCategory is specified) and compares it
// against incoming data.  The 'table' argument should pass only 'assets' or 'ephemera' strings.
//
// Incoming records will either already possess the unmatched key (in the case where extractKey is null),
// or will generate that key by calling extractKey with two arguments:  first the element in question,
// and second the entire list of current items.  (e.g.:  This is used to match scoped keys to global
// IDs of Rooms in WML schemata)
//
// A given record _already_ in the database will either match (by Asset/EphemeraId and DataCategory) with
// an incoming record, or it will not.  Likewise, a given incoming record will either match a record
// already present, or it will not.
//
// The merge function takes a map of two-element tuples, incoming and current, indexed by the key
// (DataCategory, or Asset/EphemeraId) that is *not* specified in the search.  Each of these
// tuples will contain either:
//    * A match (both incoming and current elements specified)
//    * An unmatched incoming element
//    * An unmatched current element
//
// The merge function must return a different map on the same keys.  Each key will specify either:
//    * The string 'ignore', which will do nothing
//    * The string 'delete', which will eliminate the current element if present
//    * An object that, together with the two keys unique to that position in the map, will be
//      made into the body of a PutItem operation
//
export const mergeIntoDataRange = async ({
    dbClient,
    table,
    search: {
        DataCategory,
        AssetId,
        EphemeraId
    },
    items,
    mergeFunction,
    extractKey = null
}) => {
    //
    // TODO:  Better error handling and validation throughout
    //
    const TableName = table === 'assets' ? assetsTable : ephemeraTable
    if ((DataCategory === undefined ? 0 : 1) + (AssetId === undefined ? 0 : 1) + (EphemeraId === undefined ? 0 : 1) > 1) {
        console.log(`ERROR: mergeIntoDataRange accepts only one of 'DataCategory', 'EphemeraId', and 'AssetId' search terms`)
        return;
    }
    const keyLabel = table === 'assets'
        ? AssetId ? 'DataCategory' : 'AssetId'
        : EphemeraId ? 'DataCategory': 'EphemeraId'
    const extractKeyDefault = (item) => (item[keyLabel])
    const KeyConditionExpression = DataCategory
        ? `DataCategory = :dc`
        : AssetId
            ? `AssetId = :aid`
            : `EphemeraId = eid`
    const { Items: dbItems = [] } = await dbClient.send(new QueryCommand({
        TableName,
        KeyConditionExpression,
        ExpressionAttributeValues: marshall({
            ":dc": DataCategory,
            ":aid": AssetId,
            ":eid": EphemeraId
        }, { removeUndefinedValues: true }),
        ...(DataCategory ? { IndexName: 'DataCategoryIndex' } : {})
    }))
    const currentItems = dbItems.map(unmarshall)
    const incomingItems = items.map((item) => ({
            [keyLabel]: extractKey ? extractKey(item, currentItems) : extractKeyDefault(item),
            ...item
        }))
    const firstPassMerging = currentItems.reduce((previous, item) => ({
            ...previous,
            [extractKeyDefault(item)]: { current: item }
        }), {})
    const secondPassMerging = incomingItems.reduce((previous, item) => {
        const key = extractKeyDefault(item)
        return {
            ...previous,
            [key]: {
                ...(previous[key] || {}),
                incoming: item
            }
        }
    }, firstPassMerging)
    const thirdPassMerging = Object.entries(secondPassMerging)
        .reduce((previous, [key, items]) => ({
            ...previous,
            [key]: mergeFunction(items)
        }), {})
    const deleteRecord = (key) => ({
        DeleteRequest: {
            Key: marshall({
                DataCategory,
                AssetId,
                EphemeraId,
                [keyLabel]: key
            }, { removeUndefinedValues: true })
        }
    })
    const fourthPassMerging = Object.entries(thirdPassMerging)
        .filter(([key, value]) => (value !== 'ignore'))
        .map(([key, value]) => {
            if (value === 'delete') {
                return deleteRecord(key)
            }
            else {
                return {
                    PutRequest: {
                        Item: marshall({
                            DataCategory,
                            AssetId,
                            EphemeraId,
                            [keyLabel]: key,
                            ...value
                        }, { removeUndefinedValues: true })
                    }
                }
            }
        })
    await batchWriteDispatcher(dbClient, {
        table: TableName,
        items: fourthPassMerging
    })
}

export const assetGetItem = async ({
    dbClient,
    AssetId,
    DataCategory,
    ProjectionFields = ['AssetId'],
    ExpressionAttributeNames
}) => {
    return asyncSuppressExceptions(async () => {
        const { Item = {} } = await dbClient.send(new GetItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId,
                DataCategory
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return unmarshall(Item)
    }, {})
}

export const assetQuery = async ({
    dbClient,
    AssetId,
    ProjectionFields = ['DataCategory'],
    ExpressionAttributeNames
}) => {
    return asyncSuppressExceptions(async () => {
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: assetsTable,
            KeyConditionExpression: 'AssetId = :assetId',
            ExpressionAttributeValues: marshall({
                ':assetId': AssetId
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return Items.map(unmarshall)
    }, [])
}

export const assetDataCategoryQuery = async ({
    dbClient,
    DataCategory,
    ProjectionFields = ['AssetId'],
    ExpressionAttributeNames
}) => {
    return asyncSuppressExceptions(async () => {
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: assetsTable,
            KeyConditionExpression: 'DataCategory = :dc',
            IndexName: 'DataCategoryIndex',
            ExpressionAttributeValues: marshall({
                ':dc': DataCategory
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return Items.map(unmarshall)
    }, [])
}

export const assetScopedIdQuery = async ({
    dbClient,
    ScopedId,
    DataCategory,
    ProjectionFields = ['AssetId'],
    ExpressionAttributeNames
}) => {
    const KeyConditionExpression = DataCategory
        ? 'scopedId = :scopedId AND DataCategory = :dc'
        : 'scopedId = :scopedId'
    
    return asyncSuppressExceptions(async () => {
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: assetsTable,
            KeyConditionExpression,
            IndexName: 'ScopedIdIndex',
            ExpressionAttributeValues: marshall({
                ':scopedId': ScopedId,
                ...(DataCategory ? { ':dc': DataCategory } : {})
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return Items.map(unmarshall)
    }, [])
}

export const updateAsset = async ({
    dbClient,
    AssetId,
    DataCategory,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
}) => {
    return asyncSuppressExceptions(async () => {
        await dbClient.send(new UpdateItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId,
                DataCategory
            }),
            UpdateExpression,
            ExpressionAttributeValues: marshall(ExpressionAttributeValues),
            ExpressionAttributeNames
        }))
    }, {})
}

export const putAsset = async ({
    dbClient,
    Item
}) => {
    return asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: assetsTable,
            Item: marshall(Item)
        }))
    }, {})
}

export const deleteAsset = async ({
    dbClient,
    AssetId,
    DataCategory
}) => {
    return asyncSuppressExceptions(async () => {
        await dbClient.send(new DeleteItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId,
                DataCategory
            })
        }))
    }, {})
}

export const ephemeraQuery = async ({
    dbClient,
    EphemeraId,
    ProjectionFields = ['DataCategory'],
    ExpressionAttributeNames
}) => {
    return asyncSuppressExceptions(async () => {
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            KeyConditionExpression: 'EphemeraId = :ephemeraId',
            IndexName: 'ScopedIdIndex',
            ExpressionAttributeValues: marshall({
                ':ephemeraId': EphemeraId
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return Items.map(unmarshall)
    }, [])
}

export const ephemeraDataCategoryQuery = async ({
    dbClient,
    DataCategory,
    ProjectionFields = ['EphemeraId'],
    ExpressionAttributeNames
}) => {
    return asyncSuppressExceptions(async () => {
        const { Items = [] } = await dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            KeyConditionExpression: 'DataCategory = :dc',
            IndexName: 'DataCategoryIndex',
            ExpressionAttributeValues: marshall({
                ':dc': DataCategory
            }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return Items.map(unmarshall)
    }, [])
}

export const putEphemera = async ({
    dbClient,
    Item
}) => {
    return asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: ephemeraTable,
            Item: marshall(Item)
        }))
    }, {})
}

export const updateEphemera = async ({
    dbClient,
    EphemeraId,
    DataCategory,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
}) => {
    return asyncSuppressExceptions(async () => {
        await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory
            }),
            UpdateExpression,
            ExpressionAttributeValues: marshall(ExpressionAttributeValues),
            ExpressionAttributeNames
        }))
    }, {})
}
