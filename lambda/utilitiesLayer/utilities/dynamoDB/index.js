import {
    DynamoDBClient,
    GetItemCommand,
    UpdateItemCommand,
    PutItemCommand,
    DeleteItemCommand,
    QueryCommand,
    BatchWriteItemCommand,
    BatchGetItemCommand,
    ScanCommand
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { asyncSuppressExceptions } from '../errors.js'
import { abstractQuery } from './query.js'

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`
const messageTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

const params = { region: process.env.AWS_REGION }
const dbClient = new DynamoDBClient(params)

export const batchWriteDispatcher = ({ table, items }) => {
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

export const batchGetDispatcher = async ({ table, items, projectionExpression }) => {
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
    const outcomes = await Promise.all(batchPromises)
    return outcomes.reduce((previous, { Responses = {} }) => {
        return [
            ...previous,
            ...(Responses[table] || []).map(unmarshall)
        ]}, [])
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
    await batchWriteDispatcher({
        table: TableName,
        items: fourthPassMerging
    })
}

const abstractGetItem = (table) => async ({
    AssetId,
    EphemeraId,
    MessageId,
    DataCategory,
    ProjectionFields = [
        table === assetsTable
            ? 'AssetId'
            : table === ephemeraTable
                ? 'EphemeraId'
                : 'MessageId'
    ],
    ExpressionAttributeNames
}) => {
    return await asyncSuppressExceptions(async () => {
        const { Item = {} } = await dbClient.send(new GetItemCommand({
            TableName: table,
            Key: marshall({
                AssetId,
                EphemeraId,
                MessageId,
                DataCategory
            }, { removeUndefinedValues: true }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        }))
        return unmarshall(Item)
    })
}

export const assetGetItem = abstractGetItem(assetsTable)

export const assetQuery = abstractQuery(dbClient, assetsTable)

export const updateAsset = async ({
    AssetId,
    DataCategory,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues
}) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new UpdateItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId,
                DataCategory
            }),
            UpdateExpression,
            ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
            ExpressionAttributeNames
        }))
    })
}

const abstractPutItem = (table) => async (item) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: table,
            Item: marshall(item, { removeUndefinedValues: true })
        }))
    })
}

//
// TODO:  Error handling to respond if the DynamoDB service throws an error
//
export const replaceItem = abstractPutItem(assetsTable)

export const putAsset = async ({
    Item
}) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: assetsTable,
            Item: marshall(Item, { removeUndefinedValues: true })
        }))
    })
}

export const deleteAsset = async ({
    AssetId,
    DataCategory
}) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new DeleteItemCommand({
            TableName: assetsTable,
            Key: marshall({
                AssetId,
                DataCategory
            })
        }))
    })
}

export const ephemeraGetItem = abstractGetItem(ephemeraTable)

export const ephemeraQuery = abstractQuery(dbClient, ephemeraTable)

export const putEphemera = async ({
    Item
}) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: ephemeraTable,
            Item: marshall(Item)
        }))
    })
}

export const deleteEphemera = async ({
    EphemeraId,
    DataCategory
}) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new DeleteItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory
            })
        }))
    })
}

export const updateEphemera = async ({
    EphemeraId,
    DataCategory,
    UpdateExpression,
    ExpressionAttributeNames,
    ExpressionAttributeValues,
    catchException = () => ({})
}) => {
    return await asyncSuppressExceptions(async () => {
        const { Attributes = {} } = await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory
            }),
            UpdateExpression,
            ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
            ExpressionAttributeNames
        }))
        return unmarshall(Attributes)
    }, catchException)
}

export const scanEphemera = async ({
    FilterExpression,
    ExpressionAttributeValues,
    ExpressionAttributeNames,
    ProjectionFields = ['EphemeraId'],
    ReturnValues
}) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new ScanCommand({
            TableName: ephemeraTable,
            FilterExpression,
            ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }),
            ExpressionAttributeNames,
            ProjectionExpression: ProjectionFields.join(', '),
            ReturnValues
        }))
    })
}

export const publishMessage = async (Item) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: messageTable,
            Item: marshall({
                DataCategory: 'Meta::Message',
                ...Item
            })
        }))
    })
}

export const messageDataCategoryQuery = async ({
    DataCategory,
    ExpressionAttributeNames,
    ExclusiveStartKey
}) => {
    return await asyncSuppressExceptions(async () => {
        const { Items = [], LastEvaluatedKey } = await dbClient.send(new QueryCommand({
            TableName: messageTable,
            KeyConditionExpression: 'DataCategory = :dc',
            IndexName: 'DataCategoryIndex',
            ExpressionAttributeValues: marshall({
                ':dc': DataCategory
            }),
            ExpressionAttributeNames,
            ExclusiveStartKey
        }))
        return {
            Items: Items.map(unmarshall),
            LastEvaluatedKey
        }
    }, () => ([]))
}

export const messageDeltaQuery = async ({
    Target,
    ExpressionAttributeNames,
    ExclusiveStartKey,
    StartingAt,
    Limit
}) => {
    return await asyncSuppressExceptions(async () => {
        const { Items = [], LastEvaluatedKey } = await dbClient.send(new QueryCommand({
            TableName: deltaTable,
            KeyConditionExpression: 'Target = :Target and DeltaId >= :Start',
            ExpressionAttributeValues: marshall({
                ':Target': Target,
                ':Start': `${StartingAt}`
            }),
            ExpressionAttributeNames,
            ExclusiveStartKey,
            Limit
        }))
        return {
            Items: Items.map(unmarshall),
            LastEvaluatedKey
        }
    }, () => ([]))
}