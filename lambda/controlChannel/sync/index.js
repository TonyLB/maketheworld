import { messageDataCategoryQuery, messageDeltaQuery } from '/opt/utilities/dynamoDB/index.js'
import { socketQueueFactory } from '/opt/utilities/apiManagement/index.js'

//
// syncRawHelper executes one step of the raw sync operation (either the first query or subsequent
// steps defined by the returned ExclusiveStartKey) and returns the unmarshalled and parsed results.
//
const syncRawHelper = async ({ TargetId, limit = null, ExclusiveStartKey = null }) => {

    const epochTime = Date.now()

    const { Items, LastEvaluatedKey } = await messageDataCategoryQuery({
        DataCategory: `CHARACTER#${TargetId}`,
        ...(ExclusiveStartKey ? { ExclusiveStartKey } : {})
    })

    return {
        Items: Items
            .map(({ DataCategory, ...rest }) => ({ Target: TargetId, ...rest })),
        LastEvaluatedKey,
        LastSync: LastEvaluatedKey ? null : epochTime,
    }

}

//
// syncDeltaHelper executes one step of the delta sync operation (either the first query or subsequent
// steps defined by the returned ExclusiveStartKey) and returns the unmarshalled and parsed results.
//
const syncDeltaHelper = async ({
    TargetId,
    startingAt = null,
    limit = null,
    ExclusiveStartKey = null
}) => {
    const epochTime = Date.now()
    const { Items, LastEvaluatedKey } = await messageDeltaQuery({
        Target: `CHARACTER#${TargetId}`,
        StartingAt: startingAt,
        Limit: limit,
        ExclusiveStartKey
    })
    return {
        Items: Items
            .map(({ Target, DeltaId, RowId, ...rest }) => ({ Target: TargetId, MessageId: RowId, ...rest })),
        LastEvaluatedKey,
        LastSync: LastEvaluatedKey ? null : epochTime
    }

}

export const sync = async ({
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
    const socketQueue = socketQueueFactory()
    while (!LastSync && loopCount < 20) {
        const returnVal = (type === 'Raw')
            ? await syncRawHelper({
                TargetId,
                limit,
                ExclusiveStartKey: LastEvaluatedKey
            })
            : await syncDeltaHelper({
                TargetId,
                startingAt,
                limit,
                ExclusiveStartKey: LastEvaluatedKey
            })
        //
        // TODO: Error handling for failed query calls
        //
        socketQueue.send({
            ConnectionId,
            Message: {
                messageType: 'Messages',
                messages: returnVal.Items,
                ...(returnVal.LastSync ? { LastSync: returnVal.LastSync, RequestId } : {})
            }
        })
        //
        // TODO: Error handling for failed websocket calls
        //
        LastSync = returnVal.LastSync
        LastEvaluatedKey = returnVal.LastEvaluatedKey
        loopCount++
    }
    await socketQueue.flush()
}
