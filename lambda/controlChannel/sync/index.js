const { QueryCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')

const { TABLE_PREFIX } = process.env;
const messagesTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

//
// syncRawHelper executes one step of the raw sync operation (either the first query or subsequent
// steps defined by the returned ExclusiveStartKey) and returns the unmarshalled and parsed results.
//
const syncRawHelper = async (dbClient, { TargetId, limit = null, ExclusiveStartKey = null }) => {

    const epochTime = Date.now()

    const { Items, LastEvaluatedKey } = await dbClient.send(new QueryCommand({
        TableName: messagesTable,
        ...(limit ? { Limit: limit } : {}),
        KeyConditionExpression: "DataCategory = :Target",
        IndexName: 'DataCategoryIndex',
        ExpressionAttributeValues: marshall({
            ":Target": 'CHARACTER#' + TargetId
        }),
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {})
    }))

    return {
        Items: Items
            .map(unmarshall)
            .map(({ DataCategory, ...rest }) => ({ Target: TargetId, ...rest })),
        LastEvaluatedKey,
        LastSync: LastEvaluatedKey ? null : epochTime,
    }

}

//
// syncDeltaHelper executes one step of the delta sync operation (either the first query or subsequent
// steps defined by the returned ExclusiveStartKey) and returns the unmarshalled and parsed results.
//
const syncDeltaHelper = async (dbClient, {
    TargetId,
    startingAt = null,
    limit = null,
    ExclusiveStartKey = null
}) => {
    const epochTime = Date.now()
    const { Items, LastEvaluatedKey } = await dbClient.send(new QueryCommand({
        TableName: deltaTable,
        ...(limit ? { Limit: limit } : {}),
        KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
        ExpressionAttributeValues: marshall({
            ":Target": 'CHARACTER#' + TargetId,
            ":Start": `${startingAt}`
        }),
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {})
    }))
    return {
        Items: Items
            .map(unmarshall)
            .map(({ Target, DeltaId, RowId, ...rest }) => ({ Target: TargetId, MessageId: RowId, ...rest })),
        LastEvaluatedKey,
        LastSync: LastEvaluatedKey ? null : epochTime
    }

}

const sync = async (dbClient, apiClient, {
    type, // 'Delta' or 'Raw'
    RequestId,
    ConnectionId,
    TargetId,
    startingAt = null,
    limit = null
}) => {
    let LastSync = null
    let LastEvaluatedKey = null
    let loopCount = 0
    let sendPromises = []
    while (!LastSync && loopCount < 20) {
        const returnVal = (type === 'Raw')
            ? await syncRawHelper(dbClient, {
                TargetId,
                limit,
                ExclusiveStartKey: LastEvaluatedKey
            })
            : await syncDeltaHelper(dbClient, {
                TargetId,
                startingAt,
                limit,
                ExclusiveStartKey: LastEvaluatedKey
            })
        //
        // TODO: Error handling for failed query calls
        //
        sendPromises.push(apiClient.send(new PostToConnectionCommand({
            ConnectionId,
            Data: JSON.stringify({
                messageType: 'Messages',
                messages: returnVal.Items,
                ...(returnVal.LastSync ? { LastSync: returnVal.LastSync, RequestId } : {})
            })
        })))
        //
        // TODO: Error handling for failed websocket calls
        //
        LastSync = returnVal.LastSync
        LastEvaluatedKey = returnVal.LastEvaluatedKey
        loopCount++
    }
    await Promise.all(sendPromises)
}

exports.sync = sync
