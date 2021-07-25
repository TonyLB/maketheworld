//
// I don't love having a central mutable repository (even if each state is treated as an immutable change),
// but it simplifies the passing and accumulating of feedback *so much* that it's a worthwhile tradeoff
// for code-simplicity and legibility.
//

const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb')
const { unmarshall, marshall } = require('@aws-sdk/util-dynamodb')
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')

const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const dbClient = new DynamoDBClient({ region: process.env.AWS_REGION })

let queueStorage = []

const queueClear = () => {
    queueStorage = []
}

const queueAdd = (item) => {
    queueStorage = [...queueStorage, item]
}

const queueState = () => {
    return queueStorage
}

const queueFlush = async () => {
    const { Item } = await dbClient.send(new GetItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId: 'Global',
            DataCategory: 'Connections'
        }),
        ProjectionExpression: 'connections'
    }))

    const connections = [...(unmarshall(Item).connections || [])]

    if (queueStorage.length > 0) {
        await Promise.all(
            connections.map((ConnectionId) => (
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

exports.queueClear = queueClear
exports.queueAdd = queueAdd
exports.queueState = queueState
exports.queueFlush = queueFlush
