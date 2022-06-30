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

import { produce } from 'immer'

import { asyncSuppressExceptions } from '../errors'
import { DEVELOPER_MODE } from '../constants'
import { assetsQueryFactory, ephemeraQueryFactory } from './query'
import delayPromise from "./delayPromise"

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`
const messageTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

const params = { region: process.env.AWS_REGION }
const dbClient = new DynamoDBClient(params)

const paginateList = (items, pageSize) => {
    const { requestLists, current } = items
        .reduce((({ current, requestLists }, item) => {
            if (current.length >= pageSize) {
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
    return [...requestLists, current]
}

export const batchWriteDispatcher = ({ table, items }) => {
    const batchPromises = paginateList(items, 20)
        .filter((itemList) => (itemList.length))
        .map((itemList) => (dbClient.send(new BatchWriteItemCommand({ RequestItems: {
            [table]: itemList
        } }))))
    return Promise.all(batchPromises)
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
}: {
    table: string;
    search: {
        DataCategory?: string;
        AssetId?: string;
        EphemeraId?: string;
    };
    items: any[];
    mergeFunction: <I, C>({ incoming: I, current: C}) => Record<keyof I | keyof C, 'ignore' | 'delete' | Record<string, any>>;
    extractKey: null | ((item: Record<string, any>, currentItems: Record<string, any>[]) => string);
}) => {
    //
    // TODO:  Better error handling and validation throughout
    //
    const TableName = table === 'assets' ? assetsTable : ephemeraTable
    if ((DataCategory === undefined ? 0 : 1) + (AssetId === undefined ? 0 : 1) + (EphemeraId === undefined ? 0 : 1) > 1) {
        return
    }
    const keyLabel = table === 'assets'
        ? AssetId ? 'DataCategory' : 'AssetId'
        : EphemeraId ? 'DataCategory': 'EphemeraId'
    const extractKeyDefault = (item: Record<string, any>) => (item[keyLabel])
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
    const currentItems = dbItems.map((value) => (unmarshall(value)))
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
            [key]: mergeFunction(items as { current: any, incoming: any })
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
                            ...(value as Record<string, any>)
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

const abstractBatchGet = (table) => async ({
    Items,
    ExpressionAttributeNames,
    ProjectionFields
}) => {
    const batchPromises = paginateList(Items, 40)
        .filter((itemList) => (itemList.length))
        .map((itemList) => (dbClient.send(new BatchGetItemCommand({ RequestItems: {
            [table]: {
                Keys: itemList.map(marshall),
                ProjectionExpression: ProjectionFields.join(', '),
                ExpressionAttributeNames
            }
        } }))))
    const outcomes = await Promise.all(batchPromises)
    return outcomes.reduce((previous, { Responses = {} }) => {
        return [
            ...previous,
            ...(Responses[table] || []).map((value) => (unmarshall(value)))
        ]}, [] as Record<string, any>[])
}

export const abstractUpdate = (table) => async (props) => {
    const {
        AssetId,
        EphemeraId,
        MessageId,
        DataCategory,
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues,
        catchException = () => ({})
    } = props
    return await asyncSuppressExceptions(async () => {
        const { Attributes = {} } = await dbClient.send(new UpdateItemCommand({
            TableName: table,
            Key: marshall({
                AssetId,
                EphemeraId,
                MessageId,
                DataCategory
            }, { removeUndefinedValues: true }),
            UpdateExpression,
            ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
            ExpressionAttributeNames,
            ReturnValues
        }))
        return unmarshall(Attributes)
    }, catchException)
}

//
// optimisticUpdate fetches the current state of the keys you intend to update,
// and then runs that record through a change procedure (per Immer) to change
// their values.  If the reducer causes some changes, then the update attempts
// to update the DB record ... conditional on all of those values still being
// the same they were when they were first fetched.  Otherwise, it knows that
// it is in a potential deadlock condition with other updates, and so pauses for
// incremental backoff, and tries again (fetching and reducing from scratch)
// until such time as either (a) the reducer causes no changes or (b) it succeeds
// in completing a cycle without any other process side-effecting the same fields.
//
export const abstractOptimisticUpdate = (table) => async (props) => {
    const {
        key: {
            AssetId,
            EphemeraId,
            MessageId,
            DataCategory    
        },
        updateKeys,
        updateReducer,
        ExpressionAttributeNames,
        ReturnValues,
        maxRetries = 5,
        catchException = () => ({})
    } = props
    if (!updateKeys) {
        return {}
    }
    const Key = marshall({
        AssetId,
        EphemeraId,
        MessageId,
        DataCategory
    }, { removeUndefinedValues: true })
    let retries = 0
    let exponentialBackoff = 100
    let returnValue: Record<string, any> = {}
    let completed = false
    while(!completed && retries <= maxRetries) {
        completed = true
        const state = await abstractGetItem(table)({
            AssetId,
            EphemeraId,
            MessageId,
            DataCategory,
            ProjectionFields: updateKeys,
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        } as any)
        const newState = produce(state, updateReducer)
        if (newState === state) {
            returnValue = state || returnValue
            break
        }
        try {
            if (state && newState && Object.keys(state || {}).length) {
                //
                // Updating an existing record
                //
                const startingDraft: {
                    ExpressionAttributeValues: Record<string, any>;
                    setExpressions: string[];
                    removeExpressions: string[];
                    conditionExpressions: string[];
                } = {
                    ExpressionAttributeValues: {},
                    setExpressions: [],
                    removeExpressions: [],
                    conditionExpressions: []
                }
                const { ExpressionAttributeValues, setExpressions, removeExpressions, conditionExpressions } = produce(startingDraft, (draft) => {
                    updateKeys.forEach((key, index) => {
                        if (key in state && state[key] !== undefined) {
                            if (newState[key] === undefined) {
                                //
                                // Remove existing item
                                //
                                draft.removeExpressions.push(`${key}`)
                            }
                            if (key in newState && newState[key] !== undefined && newState[key] !== state[key]) {
                                //
                                // Update existing item to new value
                                //
                                draft.ExpressionAttributeValues[`:Old${index}`] = state[key]
                                draft.ExpressionAttributeValues[`:New${index}`] = newState[key]
                                draft.setExpressions.push(`${key} = :New${index}`)
                                draft.conditionExpressions.push(`${key} = :Old${index}`)
                            }
                        }
                        else {
                            draft.conditionExpressions.push(`attribute_not_exists(${key})`)
                            if (key in newState && newState[key] !== undefined) {
                                //
                                // Add new item
                                //
                                draft.ExpressionAttributeValues[`:New${index}`] = newState[key]
                                draft.setExpressions.push(`${key} = :New${index}`)
                            }
                        }
                    })
                })
                const UpdateExpression = [
                    setExpressions.length ? `SET ${setExpressions.join(', ')}` : '',
                    removeExpressions.length ? `REMOVE ${removeExpressions.join(', ')}` : ''
                ].filter((value) => (value)).join(' ')
                if (!UpdateExpression) {
                    returnValue = state
                    break
                }
                const { Attributes = {} } = await dbClient.send(new UpdateItemCommand({
                    TableName: table,
                    Key,
                    UpdateExpression,
                    ...(conditionExpressions.length ? {
                        ConditionExpression: conditionExpressions.join(' AND ')
                    } : {}),
                    ...(ExpressionAttributeValues ? { ExpressionAttributeValues: marshall(ExpressionAttributeValues, { removeUndefinedValues: true }) } : {}),
                    ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {}),
                    ReturnValues
                }))
                returnValue = unmarshall(Attributes)
                break
            }
            else {
                //
                // Putting a new record
                //
                await dbClient.send(new PutItemCommand({
                    TableName: table,
                    Item: marshall({
                        ...newState,
                        AssetId,
                        EphemeraId,
                        MessageId,
                        DataCategory
                    }, { removeUndefinedValues: true }),
                    ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {}),
                    ConditionExpression: "attribute_not_exists(DataCategory)"
                }))
            }
            returnValue = {
                ...newState,
                AssetId,
                EphemeraId,
                MessageId,
                DataCategory
            }
        }
        catch (err: any) {
            if (err.code === 'ConditionalCheckFailedException') {
                await delayPromise(exponentialBackoff)
                exponentialBackoff = exponentialBackoff * 2
                retries++
                completed = false
            }
            else {
                if (DEVELOPER_MODE) {
                    throw err
                }
                else {
                    returnValue = catchException(err)
                }
            }
        }
    }
    //
    // TODO: Create custom error type to throw when the optimisticUpdate fails
    // entirely
    //
    return returnValue
}

const abstractPutItem = (table) => async (item) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: table,
            Item: marshall(item, { removeUndefinedValues: true })
        }))
    })
}

const abstractDeleteItem = (table) => async (key) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new DeleteItemCommand({
            TableName: table,
            Key: marshall(key, { removeUndefinedValues: true })
        }))
    })
}

export const ephemeraDB = {
    getItem: abstractGetItem(ephemeraTable),
    batchGetItem: abstractBatchGet(ephemeraTable),
    query: ephemeraQueryFactory(dbClient),
    update: abstractUpdate(ephemeraTable),
    optimisticUpdate: abstractOptimisticUpdate(ephemeraTable),
    putItem: abstractPutItem(ephemeraTable),
    deleteItem: abstractDeleteItem(ephemeraTable)
}

export const assetDB = {
    getItem: abstractGetItem(assetsTable),
    batchGetItem: abstractBatchGet(assetsTable),
    query: assetsQueryFactory(dbClient),
    update: abstractUpdate(assetsTable),
    optimisticUpdate: abstractOptimisticUpdate(assetsTable),
    putItem: abstractPutItem(assetsTable),
    deleteItem: abstractDeleteItem(assetsTable)
}

export const publishMessage = async (Item) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: messageTable,
            Item: marshall({
                DataCategory: 'Meta::Message',
                ...Item
            }, { removeUndefinedValues: true })
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
            Items: Items.map((value) => (unmarshall(value))),
            LastEvaluatedKey
        }
    }, async () => ([] as Record<string, any>[]))
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
            Items: Items.map((value) => (unmarshall(value))),
            LastEvaluatedKey
        }
    }, async () => ([] as Record<string, any>[]))
}

export const messageDelete = abstractDeleteItem(messageTable)
