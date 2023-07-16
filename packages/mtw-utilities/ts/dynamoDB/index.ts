import {
    DynamoDBClient,
    GetItemCommand,
    UpdateItemCommand,
    PutItemCommand,
    DeleteItemCommand,
    QueryCommand,
    BatchWriteItemCommand,
    BatchGetItemCommand,
    AttributeValue,
    TransactWriteItemsCommand,
    TransactWriteItem
} from "@aws-sdk/client-dynamodb"
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { produce } from 'immer'

import { asyncSuppressExceptions } from '../errors'
import { DEVELOPER_MODE } from '../constants'
import { assetsQueryFactory, ephemeraQueryFactory, connectionsQueryFactory } from './query'
import delayPromise from "./delayPromise"
import { splitType } from "../types"
import { WritableDraft } from "immer/dist/internal"
import { objectMap } from "../objects"
import withMerge from "./mixins/merge"
import withTransaction from "./mixins/transact"
import withUpdate from "./mixins/update"
import withGetOperations from "./mixins/get"
import withQuery from "./mixins/query"
import withBatchWrite from "./mixins/batchWrite"
import { DBHandlerBase } from "./baseClasses"
import withPrimitives from "./mixins/primitives"

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const assetsTable = `${TABLE_PREFIX}_assets`
const connectionsTable = `${TABLE_PREFIX}_connections`
const messageTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

const params = { region: process.env.AWS_REGION }
const dbClient = new DynamoDBClient(params)

//
// TODO: Replace hard-coded handlers like assetDB, ephemeraDB, with class instances
//
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

type GetItemExtendedProps = {
    ProjectionFields?: string[];
    ExpressionAttributeNames?: Record<string, string>;
    ConsistentRead?: boolean;
}

const abstractGetItem = <Key extends { DataCategory: string }>(table: string) => async <T extends Record<string, any>>(props: Key & GetItemExtendedProps): Promise<T | undefined> => {
    const {
        AssetId,
        EphemeraId,
        MessageId,
        ConnectionId,
        DataCategory,
        ProjectionFields = [
            table === assetsTable
                ? 'AssetId'
                : table === ephemeraTable
                    ? 'EphemeraId'
                    : table === connectionsTable
                        ? 'ConnectionId'
                        : 'MessageId'
        ],
        ExpressionAttributeNames,
        ConsistentRead = false
    } = props as any
    return await asyncSuppressExceptions(async () => {
        const { Item = null } = await dbClient.send(new GetItemCommand({
            TableName: table,
            Key: marshall({
                AssetId,
                EphemeraId,
                MessageId,
                ConnectionId,
                DataCategory
            }, { removeUndefinedValues: true }),
            ProjectionExpression: ProjectionFields.join(', '),
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {}),
            ConsistentRead
        }))
        return Item ? unmarshall(Item) : undefined
    }, async () => (undefined)) as T | undefined
}

const abstractBatchGet = <Key extends { DataCategory: string }>(table: string) => async <T extends Record<string, any>>({
    Items, ExpressionAttributeNames, ProjectionFields
}: {
    Items: Key[],
    ExpressionAttributeNames?: Record<string, string>,
    ProjectionFields: string[]
}): Promise<T[]> => {
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
            ...(Responses[table] || []).map((value) => (unmarshall(value) as T))
        ]}, [] as T[])
}

type UpdateExpressionProps = {
    UpdateExpression: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, any>;
    ReturnValues?: string[],
    catchException?: (err: any) => void;
}

export const abstractUpdate = <Key extends { DataCategory: string }>(table: string) => async (props: Key & UpdateExpressionProps) => {
    const {
        AssetId,
        EphemeraId,
        MessageId,
        ConnectionId,
        DataCategory,
        UpdateExpression,
        ExpressionAttributeNames,
        ExpressionAttributeValues,
        ReturnValues,
        catchException = () => ({})
    } = props as any
    return await asyncSuppressExceptions(async () => {
        const { Attributes = {} } = await dbClient.send(new UpdateItemCommand({
            TableName: table,
            Key: marshall({
                AssetId,
                EphemeraId,
                MessageId,
                ConnectionId,
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

type DynamicUpdateOutput = {
    ExpressionAttributeNames: Record<string, any>;
    ExpressionAttributeValues: Record<string, any>;
    setExpressions: string[];
    removeExpressions: string[];
    conditionExpressions: string[];
}

const updateByReducer = <T extends Record<string, any>>({ updateKeys, ExpressionAttributeNames, reducer }: { updateKeys: string[]; ExpressionAttributeNames: Record<string, string>; reducer: (draft: WritableDraft<T>) => void }) => (state: T | undefined): DynamicUpdateOutput | {} => {
    const newState = produce(state || {}, reducer)
    if (newState === state) {
        return {}
    }
    if (typeof state === 'object' && typeof newState === 'object') {
        //
        // Updating an existing record
        //
        const startingDraft: {
            ExpressionAttributeNames: Record<string, any>;
            ExpressionAttributeValues: Record<string, any>;
            setExpressions: string[];
            removeExpressions: string[];
            conditionExpressions: string[];
        } = {
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {},
            setExpressions: [],
            removeExpressions: [],
            conditionExpressions: []
        }
        return produce(startingDraft, (draft) => {
            updateKeys.forEach((key, index) => {
                const translatedKey = (ExpressionAttributeNames && key in ExpressionAttributeNames) ? ExpressionAttributeNames[key] : key
                if (typeof state === 'object' && translatedKey in state && (typeof state[translatedKey] !== 'undefined')) {
                    if (newState?.[translatedKey] === undefined) {
                        //
                        // Remove existing item
                        //
                        draft.removeExpressions.push(`${key}`)
                        draft.ExpressionAttributeValues[`:Old${index}`] = state[translatedKey]
                        draft.conditionExpressions.push(`${key} = :Old${index}`)
                        if (ExpressionAttributeNames && key in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[key] = translatedKey
                        }
                    }
                    if (typeof newState === 'object' && translatedKey in newState && (typeof newState[translatedKey] !== 'undefined') && newState[translatedKey] !== state[translatedKey]) {
                        //
                        // Update existing item to new value
                        //
                        draft.ExpressionAttributeValues[`:Old${index}`] = state[translatedKey]
                        draft.ExpressionAttributeValues[`:New${index}`] = newState[translatedKey]
                        draft.setExpressions.push(`${key} = :New${index}`)
                        draft.conditionExpressions.push(`${key} = :Old${index}`)
                        if (ExpressionAttributeNames && key in ExpressionAttributeNames) {
                            draft.ExpressionAttributeNames[key] = translatedKey
                        }
                    }
                }
                else {
                    draft.conditionExpressions.push(`attribute_not_exists(${key})`)
                    if (ExpressionAttributeNames && key in ExpressionAttributeNames) {
                        draft.ExpressionAttributeNames[key] = translatedKey
                    }
                    if (typeof newState === 'object' && translatedKey in newState && newState[translatedKey] !== undefined) {
                        //
                        // Add new item
                        //
                        draft.ExpressionAttributeValues[`:New${index}`] = newState[translatedKey]
                        draft.setExpressions.push(`${key} = :New${index}`)
                    }
                }
            })
        })
    }
    else {
        //
        // Putting a new record
        //
        const startingDraft: {
            ExpressionAttributeNames: Record<string, any>;
            ExpressionAttributeValues: Record<string, any>;
            setExpressions: string[];
            removeExpressions: string[];
            conditionExpressions: string[];
        } = {
            ExpressionAttributeNames: {},
            ExpressionAttributeValues: {},
            setExpressions: [],
            removeExpressions: [],
            conditionExpressions: []
        }
        return produce(startingDraft, (draft) => {
            draft.conditionExpressions.push(`attribute_not_exists(DataCategory)`)
            updateKeys.forEach((key, index) => {
                const translatedKey = (ExpressionAttributeNames && key in ExpressionAttributeNames) ? ExpressionAttributeNames[key] : key
                if (newState && translatedKey in newState && newState[translatedKey] !== undefined) {
                    //
                    // Add new item
                    //
                    if (ExpressionAttributeNames && key in ExpressionAttributeNames) {
                        draft.ExpressionAttributeNames[key] = translatedKey
                    }
                    draft.ExpressionAttributeValues[`:New${index}`] = newState[translatedKey]
                    draft.setExpressions.push(`${key} = :New${index}`)
                }
            })
        })
    }

}

const isDynamicUpdateOutput = (item: {} | DynamicUpdateOutput): item is DynamicUpdateOutput => (Object.values(item).length > 0)

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
            ConnectionId,
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
        ConnectionId,
        DataCategory
    }, { removeUndefinedValues: true })
    let retries = 0
    let exponentialBackoff = 100
    let returnValue: Record<string, any> = {}
    let completed = false
    while(!completed && retries <= maxRetries) {
        completed = true
        const stateFetch = await abstractGetItem(table)({
            AssetId,
            EphemeraId,
            MessageId,
            ConnectionId,
            DataCategory,
            ProjectionFields: updateKeys,
            ...(ExpressionAttributeNames ? { ExpressionAttributeNames } : {})
        } as any)
        const state = stateFetch || {}
        const updateOutput = updateByReducer({
            updateKeys,
            ExpressionAttributeNames,
            reducer: updateReducer
        })(stateFetch)
        if (!isDynamicUpdateOutput(updateOutput)) {
            returnValue = state || returnValue
            break
        }
        else {
            const { ExpressionAttributeNames: newExpressionAttributeNames, ExpressionAttributeValues, setExpressions, removeExpressions, conditionExpressions } = updateOutput
            try {
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
                    ...((newExpressionAttributeNames && Object.values(newExpressionAttributeNames).length > 0) ? { ExpressionAttributeNames: newExpressionAttributeNames } : {}),
                    ReturnValues
                }))
                returnValue = unmarshall(Attributes)
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
    }
    //
    // TODO: Create custom error type to throw when the optimisticUpdate fails
    // entirely
    //
    return returnValue
}

const abstractPutItem = <Key extends { DataCategory: string }>(table: string) => async <T extends Key>(item: T) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: table,
            Item: marshall(item, { removeUndefinedValues: true })
        }))
    })
}

const abstractDeleteItem = <Key extends { DataCategory: string }>(table: string) => async (key: Key): Promise<void> => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new DeleteItemCommand({
            TableName: table,
            Key: marshall(key, { removeUndefinedValues: true })
        }))
    }) as void
}

type EphemeraDBKey = {
    EphemeraId: string;
    DataCategory: string;
}

export const exponentialBackoffWrapper = async <T>(tryClause: () => Promise<T>, options: { retryErrors: string[], retryCallback?: () => Promise<void> }): Promise<T | undefined> => {
    let retries = 0
    let exponentialBackoff = 100
    let completed = false
    const maxRetries = 5
    while(!completed && retries <= maxRetries) {
        completed = true
        try {
            return await tryClause()
        }
        catch (err: any) {
            if ((options?.retryErrors || ['ConditionalCheckFailedException']).includes(err.errorType)) {
                await Promise.all([
                    delayPromise(exponentialBackoff),
                    ...(options.retryCallback ? [options.retryCallback()] : [])
                ])
                exponentialBackoff = exponentialBackoff * 2
                retries++
                completed = false
            }
            else {
                if (DEVELOPER_MODE) {
                    // console.log(`Throwing exception on: ${item.EphemeraId}`)
                    // console.log(`Item: ${JSON.stringify(item, null, 4)}`)
                    throw err
                }
            }
        }
    }
    return undefined
}

export const multiTableTransactWrite = async (items: TransactWriteItem[]): Promise<void> => {
    const remapTable = (table: string) => {
        if (table === 'Ephemera') {
            return ephemeraTable
        }
        if (table === 'Connections') {
            return connectionsTable
        }
        if (table === 'Assets') {
            return assetsTable
        }
        if (table === 'Messages') {
            return messageTable
        }
        if (table === 'MessageDeltas') {
            return deltaTable
        }
        throw new Error(`Illegal table in multiTableTransactWrite: ${table}`)
    }
    const remappedItems = items
        .map((entry) => (objectMap(entry, ({ TableName, ...rest }) => ({
            TableName: remapTable(TableName || ''),
            ...rest
        }))))
    await dbClient.send(new TransactWriteItemsCommand({ TransactItems: remappedItems }))
}

export const multiTableTransactWriteGeneric = async (items: TransactWriteItem[]): Promise<void> => {
    const remapTable = (table: string) => {
        if (table === 'Ephemera') {
            return [ephemeraTable, 'EphemeraId']
        }
        if (table === 'Connections') {
            return [connectionsTable, 'ConnectionId']
        }
        if (table === 'Assets') {
            return [assetsTable, 'AssetId']
        }
        if (table === 'Messages') {
            return [messageTable, 'MessageId']
        }
        throw new Error(`Illegal table in multiTableTransactWriteGeneric: ${table}`)
    }
    const remappedItems = items
        .map((entry) => {
            if (entry.Put) {
                const putEntry = entry.Put
                if (!putEntry || !putEntry.TableName || !putEntry.Item) {
                    throw new Error('Blank TableName or Item not allowed in multiTableTransactWriteGeneric Put')
                }
                    const { TableName: unmappedTableName, Item, ...rest } = putEntry
                const [TableName, keyLabel] = remapTable(unmappedTableName)
                if (!Item.PrimaryKey) {
                    throw new Error('Blank PrimaryKey not allowed in multiTableTransactWriteGeneric Put')
                }
                const { PrimaryKey, ...itemRest } = Item
                return {
                    Put: {
                        TableName,
                        Item: {
                            [keyLabel]: PrimaryKey,
                            ...itemRest
                        },
                        ...rest
                    }
                }
            }
            let label = ''
            if (entry.Update) {
                label = 'Update'
            }
            if (entry.Delete) {
                label = 'Delete'
            }
            if (entry.ConditionCheck) {
                label = 'ConditionCheck'
            }
            if (!label) {
                throw new Error('Illegal transaction record in multiTableTransactWriteGeneric')
            }
            const item = entry[label]
            if (!item || !item.TableName || !item.Key) {
                throw new Error('Blank TableName or Key not allowed in multiTableTransactWriteGeneric')
            }
            const { TableName: unmappedTableName, Key, ...rest } = item
            const [TableName, keyLabel] = remapTable(unmappedTableName)
            return {
                [label]: {
                    TableName,
                    Key: {
                        [keyLabel]: item.Key.PrimaryKey,
                        DataCategory: item.Key.DataCategory
                    },
                    ...rest
                }
            }
        })
    await dbClient.send(new TransactWriteItemsCommand({ TransactItems: remappedItems }))
}

export const ephemeraDB = new (
        withMerge<'EphemeraId', string>()(
            withTransaction<'EphemeraId', string>()(
                withUpdate<'EphemeraId', string>()(
                    withGetOperations<'EphemeraId', string>()(
                        withQuery<'EphemeraId', string>()(
                            withBatchWrite<'EphemeraId', string>()(
                                withPrimitives<'EphemeraId', string>()(DBHandlerBase)
                            )
                        )
                    )
                )
            )
        )
    )({
    client: dbClient,
    tableName: ephemeraTable,
    incomingKeyLabel: 'EphemeraId',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

type AssetDBKey = {
    AssetId: string;
    DataCategory: string;
}

export const assetDB = {
    getItem: abstractGetItem<AssetDBKey>(assetsTable),
    batchGetItem: abstractBatchGet<AssetDBKey>(assetsTable),
    query: assetsQueryFactory(dbClient),
    update: abstractUpdate<AssetDBKey>(assetsTable),
    optimisticUpdate: abstractOptimisticUpdate(assetsTable),
    putItem: abstractPutItem<AssetDBKey>(assetsTable),
    deleteItem: abstractDeleteItem<AssetDBKey>(assetsTable)
}

type ConnectionDBKey = {
    ConnectionId: string;
    DataCategory: string;
}

export const connectionDB = {
    getItem: abstractGetItem<ConnectionDBKey>(connectionsTable),
    batchGetItem: abstractBatchGet<ConnectionDBKey>(connectionsTable),
    query: connectionsQueryFactory(dbClient),
    update: abstractUpdate<ConnectionDBKey>(connectionsTable),
    optimisticUpdate: abstractOptimisticUpdate(connectionsTable),
    putItem: abstractPutItem<ConnectionDBKey>(connectionsTable),
    deleteItem: abstractDeleteItem<ConnectionDBKey>(connectionsTable)
}

type MessageDBKey = {
    MessageId: string;
    DataCategory: string;
}

export const messageDB = {
    putItem: async (Item) => {
        return await asyncSuppressExceptions(async () => {
            await dbClient.send(new PutItemCommand({
                TableName: messageTable,
                Item: marshall({
                    ...Item,
                    DataCategory: 'Meta::Message'
                }, { removeUndefinedValues: true })
            }))
        })
    }
}

type MessageDeltaDBKey = {
    Target: string;
    DeltaId: string;
}

export const messageDeltaDB = {
    putItem: async (Item) => {
        return await asyncSuppressExceptions(async () => {
            await dbClient.send(new PutItemCommand({
                TableName: deltaTable,
                Item: marshall(Item, { removeUndefinedValues: true })
            }))
        })
    }
}

export const publishMessage = async (Item) => {
    return await asyncSuppressExceptions(async () => {
        await dbClient.send(new PutItemCommand({
            TableName: messageTable,
            Item: marshall({
                ...Item,
                DataCategory: 'Meta::Message'
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
    Limit = 20
}: {
    Target: string;
    ExpressionAttributeNames?: Record<string, any>;
    ExclusiveStartKey?: Record<string, AttributeValue>;
    StartingAt?: number;
    Limit?: number;
}): Promise<{ Items: any[], LastEvaluatedKey?: Record<string, AttributeValue> }> => {
    return await asyncSuppressExceptions(async () => {
        const { Items = [], LastEvaluatedKey } = await dbClient.send(new QueryCommand({
            TableName: deltaTable,
            KeyConditionExpression: StartingAt ? 'Target = :Target and DeltaId >= :Start' : 'Target = :Target',
            ExpressionAttributeValues: marshall(StartingAt ? {
                ':Target': Target,
                ':Start': `${StartingAt}`
            } : { ':Target': Target }),
            ExpressionAttributeNames,
            ...(ExclusiveStartKey ? { ExclusiveStartKey } : {}),
            Limit
        }))
        return {
            Items: Items.map((value) => (unmarshall(value))),
            LastEvaluatedKey
        }
    }, async () => ({ Items: [] as any[] })) as { Items: any[], LastEvaluatedKey?: Record<string, AttributeValue> }
}

export const messageDeltaUpdate = async <T extends { Target: string, DeltaId: string }>(args: {
    Target?: string;
    RowId: string;
    UpdateTime: number;
    transform: (current: T) => T;
}): Promise<T | undefined> => {
    const { Target, RowId, UpdateTime, transform } = args
    const { Items } = await dbClient.send(new QueryCommand({
        TableName: deltaTable,
        IndexName: 'RowIdIndex',
        KeyConditionExpression: 'RowId = :RowId',
        ExpressionAttributeValues: marshall({
            ':RowId': RowId
        }),
        ScanIndexForward: false
    }))
    if (Items) {
        const deltaQuery = Items.map((item) => (unmarshall(item))) as T[]
        const mostRecentTargettedItem = deltaQuery.map(({ DeltaId }) => (DeltaId)).reduce<string>((previous, DeltaId) => ((!previous || (DeltaId.localeCompare(previous) > 0)) ? DeltaId : previous), '')
        if (mostRecentTargettedItem) {
            const fetchRecent = await dbClient.send(new GetItemCommand({
                TableName: deltaTable,
                Key: marshall({
                    Target,
                    DeltaId: mostRecentTargettedItem
                })
            }))
            if (fetchRecent.Item) {
                const fetchedValue: T = unmarshall(fetchRecent.Item) as T
                const putValue = transform(fetchedValue)
                await dbClient.send(new PutItemCommand({
                    TableName: deltaTable,
                    Item: marshall({
                        ...putValue,
                        DeltaId: `${UpdateTime}::${RowId}`
                    }, { removeUndefinedValues: true })
                }))
                return putValue
            }
        }
    }
}

export const messageDelete = abstractDeleteItem(messageTable)
