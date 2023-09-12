import {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    DeleteItemCommand,
    QueryCommand,
    AttributeValue
} from "@aws-sdk/client-dynamodb"
import AWSXRay from 'aws-xray-sdk'
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb"

import { asyncSuppressExceptions } from '../errors'
import { DEVELOPER_MODE } from '../constants'
import delayPromise from "./delayPromise"
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
const deltaTable = `${TABLE_PREFIX}_message_delta`

const params = { region: process.env.AWS_REGION }
const dbClient = AWSXRay.captureAWSv3Client(new DynamoDBClient(params))

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

const combinedMixins = <T extends string>() => (
    withMerge<T, string>()(
        withTransaction<T, string>()(
            withUpdate<T, string>()(
                withGetOperations<T, string>()(
                    withQuery<T, string>()(
                        withBatchWrite<T, string>()(
                            withPrimitives<T, string>()(DBHandlerBase)
                        )
                    )
                )
            )
        )
    )
)

export const ephemeraDB = new (combinedMixins<'EphemeraId'>())({
    client: dbClient,
    tableName: ephemeraTable,
    incomingKeyLabel: 'EphemeraId',
    internalKeyLabel: 'EphemeraId',
    options: { getBatchSize: 50 }
})

export const assetDB = new (combinedMixins<'AssetId'>())({
    client: dbClient,
    tableName: assetsTable,
    incomingKeyLabel: 'AssetId',
    internalKeyLabel: 'AssetId',
    options: { getBatchSize: 50 }
})

export const connectionDB = new (combinedMixins<'ConnectionId'>())({
    client: dbClient,
    tableName: connectionsTable,
    incomingKeyLabel: 'ConnectionId',
    internalKeyLabel: 'ConnectionId',
    options: { getBatchSize: 50 }
})

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
