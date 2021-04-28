const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { DynamoDBClient, ScanCommand, BatchWriteItemCommand } = require('@aws-sdk/client-dynamodb')

const { resolveTargets } = require('./resolveTargets')
const { putMessage } = require('./putMessage')

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })
const apiClient = new ApiGatewayManagementApiClient({
    apiVersion: '2018-11-29',
    endpoint: process.env.WEBSOCKET_API
})
//
// As of 04/22/2021, there is a bug in the ApiGateway client that
// fails to include the stage in the request path.  This middleware
// from the internet purports to fix the problem.
//
// TODO:  Keep an eye on fixes in the API.  They may introduce breaking
// changes.
//
apiClient.middlewareStack.add(
    (next) =>
        async (args) => {
            args.request.path = '/Prod' + args.request.path;
            return await next(args);
        },
    { step: "build" },
);

const messageTable = `${process.env.TABLE_PREFIX}_messages`
const deltaTable = `${process.env.TABLE_PREFIX}_message_delta`

const removeType = (value) => value.split('#').slice(1).join('#')

const batchDispatcher = ({ table, items }) => {
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

const persistMessages = (Updates = []) => {

    //
    // TODO:  Relocate epochTime defaulting higher up the calling stack
    //
    const epochTime = Date.now()

    const outputs = Updates.map((update) => {
            return putMessage({
                ...update,
                CreatedTime: update.CreatedTime || (epochTime + (update.TimeOffset || 0))
            })
        }
    )

    return Promise.all(outputs)
        .then((finalOutputs) => finalOutputs.reduce(({
                messageWrites: previousMessageWrites,
                deltaWrites: previousDeltaWrites
            },
            { messageWrites = [], deltaWrites = [] }) => ({
                messageWrites: [ ...previousMessageWrites, ...messageWrites ],
                deltaWrites: [ ...previousDeltaWrites, ...deltaWrites ]
            }), {
                messageWrites: [],
                deltaWrites: []
            }))
        .then(({ messageWrites, deltaWrites }) => {
            return Promise.all([
                batchDispatcher({ table: messageTable, items: messageWrites }),
                batchDispatcher({ table: deltaTable, items: deltaWrites })
            ])
        })
}

exports.handler = async (event) => {
    const { Messages = [] } = event

    const resolved = await resolveTargets(dbClient)(Messages)
    const { resolvedMessages, byConnectionId } = resolved
    await Promise.all([
        ...Object.entries(byConnectionId)
            .map(([ConnectionId, messages]) => (
                apiClient.send(new PostToConnectionCommand({
                    ConnectionId,
                    Data: JSON.stringify({
                        messageType: 'Messages',
                        messages
                    }, null, 4)
                }))
            )),
        persistMessages(resolvedMessages)
    ])
    return {}
}
