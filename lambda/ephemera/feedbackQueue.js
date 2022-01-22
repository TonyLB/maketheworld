//
// I don't love having a central mutable repository (even if each state is treated as an immutable change),
// but it simplifies the passing and accumulating of feedback *so much* that it's a worthwhile tradeoff
// for code-simplicity and legibility.
//

import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall, marshall } from '@aws-sdk/util-dynamodb'
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION })

let queueStorage = []

export const queueClear = () => {
    queueStorage = []
}

export const queueAdd = (item) => {
    queueStorage = [...queueStorage, item]
}

export const queueState = () => {
    return queueStorage
}

//
// TODO: Allow queue messages to (optionally) be directed to only a set of
// connections.  Reduce down to a map of targetted messages by target,
// and add that in (as you map through the global messages)
//
export const queueFlush = async () => {
    const { Item } = await dbClient.send(new GetItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId: 'Global',
            DataCategory: 'Connections'
        }),
        ProjectionExpression: 'connections'
    }))

    const connections = [...(unmarshall(Item).connections || {})]

    if (queueStorage.length > 0) {
        await Promise.all(
            Object.keys(connections).map((ConnectionId) => (
                apiClient.send(new PostToConnectionCommand({
                    ConnectionId,
                    Data: JSON.stringify({
                        messageType: 'Ephemera',
                        updates: queueStorage
                    }, null, 4)
                }))
            ))
        )
    }
    queueStorage = []
}
