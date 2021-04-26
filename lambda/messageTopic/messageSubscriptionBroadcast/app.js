//
// TODO:  Figure out a way to get appsync functionality in a lighter bundle size.
// This one is a bear to load (I think it imports the entire AWS-SDK), and it's
// probably the cause of Lambda cold-start problems.
//
const appsync = require('aws-appsync')
const gql = require('graphql-tag')
require('cross-fetch/polyfill')
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi')
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { broadcastMessages } = require('./broadcastMessages')

const REGION = process.env.AWS_REGION
const TABLE_PREFIX = process.env.TABLE_PREFIX
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

const ephemeraTable = `${TABLE_PREFIX}_ephemera`

//
// TODO:  Evaluate whether it would be better to switch back to distributing message through
// the LifeLine websocket connection (using APIGateway Management API to allow directly POSTing to
// individual websockets, rather than depending on AppSync)
//
// Benefit:  One less place where a Lambda would need to import the (bloated) AppSyncGL packages.
// Benefit:  Could overload the data structure directly, without restrictions from the GraphQL
//    input limitations
// Benefit:  Much cheaper per-message.
// Complication:  Websocket has a 128k message-size maximum (about 30 pages of text)
// Complication:  Much more likely to have a collision between messages and the hourly
//    refresh of websockets.  Need to handle that.
//

const removeType = (value) => value.split('#').slice(1).join('#')

const graphqlClient = new appsync.AWSAppSyncClient({
    url: process.env.APPSYNC_ENDPOINT_URL,
    region: process.env.AWS_REGION,
    auth: {
      type: 'AWS_IAM',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN
      }
    },
    disableOffline: true
})

const gqlGroup = (items) => {
    const mutations = items.map((mutation, index) => (`broadcast${index}: ${mutation}\n`)).join('\n')

    return gql`mutation BroadcastMessages { ${mutations} }`
}


const putMessage = (event) => {

    const { MessageId, CreatedTime, Characters = [], DisplayProtocol } = event
    let WorldMessage, CharacterMessage, DirectMessage, AnnounceMessage, RoomDescription

    const eventMapping = (props) => (props.reduce((previous, key) => ({ ...previous, [key]: event[key] }), {}))

    switch(DisplayProtocol) {
        case 'World':
            WorldMessage = eventMapping(['Message'])
            break
        case 'Player':
            CharacterMessage = eventMapping(['Message', 'CharacterId'])
            break
        case 'Direct':
            DirectMessage = eventMapping(['Message', 'CharacterId', 'Title', 'Recipients'])
            break
        case 'Announce':
            CharacterMessage = eventMapping(['Message', 'CharacterId', 'Title'])
            break
        case 'RoomDescription':
            RoomDescription = {
                ...eventMapping(['RoomId', 'Name', 'Description', 'Exits']),
                Characters: event.RoomCharacters
            }
            break
        default:
            break
    }

    const gqlWrites = broadcastMessages({
        MessageId,
        Characters,
        DisplayProtocol,
        CreatedTime,
        WorldMessage,
        CharacterMessage,
        DirectMessage,
        AnnounceMessage,
        RoomDescription
    })

    return gqlWrites
}

const updateDispatcher = (Updates = []) => {

    //
    // TODO:  Replace Date.now() with a date translation of the incoming SNS Publish time
    //
    const epochTime = Date.now()

    const outputs = Updates.map((update) => {
            return putMessage({
                ...update,
                CreatedTime: update.CreatedTime || (epochTime + (update.TimeOffset || 0))
            })
        }
    )

    const aggregateOutputs = outputs.reduce((previous, list) => ([...previous, ...(list || [])], []))
    if (aggregateOutputs.length) {
        const gqlGroupOutput = gqlGroup(aggregateOutputs)
        return graphqlClient.mutate({ mutation: gqlGroupOutput })
    }
    else {
        return Promise.resolve()
    }
}

exports.handler = (event, context) => {
    const { Records } = event

    //
    // First check for Records, to see whether this is coming from the SNS topic subscription.
    //
    if (Records) {
        const messages = Records.filter(({ Sns = {} }) => (Sns.Message))
            .map(({ Sns }) => (Sns.Message))
            .map((message) => (JSON.parse(message)))
            .filter((message) => (message))
            .reduce((previous, message) => ([...previous, ...message]), [])
        return Promise.all([
            dbClient.send(new ScanCommand({
                TableName: ephemeraTable,
                FilterExpression: "Connected = :true",
                ExpressionAttributeValues: marshall({
                    ':true': true
                }),
                ProjectionExpression: "EphemeraId, ConnectionId, RoomId"
            }))
                .then(({ Items }) => (Items.map(unmarshall)))
                .then((Items) => (Items.reduce((previous, { EphemeraId, RoomId, ConnectionId }) => ({ ...previous, [removeType(EphemeraId)]: { ConnectionId, RoomId } }), {})))
                .then((CharacterIdMapping) => (
                    //
                    // TODO:  Serialize the incoming message information into an appropriate format to send across the
                    // websocket.
                    //
                    messages.reduce((previous, { Targets = [], ...rest }) => {
                        //
                        // Translate Room targets into lists of Characters, and then deduplicate
                        //
                        const CharacterTargets = Targets.filter((targetId) => (CharacterIdMapping[targetId]))
                        const RoomTargets = Object.entries(CharacterIdMapping).filter(([_, { RoomId }]) => (Targets.includes(RoomId))).map(([key]) => (key))
                        const Characters = [...(new Set([
                            ...CharacterTargets,
                            ...RoomTargets
                        ]))]                        
                        return Characters.reduce((prev, CharacterId) => {
                            const ConnectionId = CharacterIdMapping[CharacterId].ConnectionId
                            if (ConnectionId) {
                                return {
                                    ...prev,
                                    [ConnectionId]: [...(prev[ConnectionId] || []), { Target: CharacterId, ...rest }]
                                }    
                            }
                            else {
                                return prev
                            }
                        }, previous)
                    }, {})
                ))
                .then((ConnectionMessages) => (
                    Promise.all(
                        Object.entries(ConnectionMessages)
                            .map(([ConnectionId, messages]) => (
                                apiClient.send(new PostToConnectionCommand({
                                    ConnectionId,
                                    Data: JSON.stringify({
                                        messageType: 'Messages',
                                        messages
                                    }, null, 4)
                                }))
                            ))
                    )
                )
            ),
            updateDispatcher(messages)
        ])
    }
    //
    // Otherwise return a format error
    //
    else {
        context.fail(JSON.stringify(`Error: Unknown format ${event}`))
    }

}
