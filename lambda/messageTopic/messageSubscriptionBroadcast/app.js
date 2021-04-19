//
// TODO:  Figure out a way to get appsync functionality in a lighter bundle size.
// This one is a bear to load (I think it imports the entire AWS-SDK), and it's
// probably the cause of Lambda cold-start problems.
//
const appsync = require('aws-appsync')
const gql = require('graphql-tag')
require('cross-fetch/polyfill')
const { broadcastMessages } = require('./broadcastMessages')

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
            RoomDescription = eventMapping(['RoomId', 'Name', 'Description', 'Exits', 'Characters'])
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

    return Promise.resolve(gqlWrites)
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

    return Promise.all(outputs)
        .then((results) => (results.reduce((previous, list) => ([...previous, ...(list || [])], []))))
        .then((gqlWrites) => {
            if (gqlWrites.length) {
                const gqlGroupOutput = gqlGroup(gqlWrites)
                return graphqlClient.mutate({ mutation: gqlGroupOutput })
            }
            else {
                return Promise.resolve()
            }
        })
}

exports.handler = (event, context) => {
    const { Records } = event

    //
    // First check for Records, to see whether this is coming from the SNS topic subscription.
    //
    if (Records) {
        return updateDispatcher(
            Records.filter(({ Sns = {} }) => (Sns.Message))
                .map(({ Sns }) => (Sns.Message))
                .map((message) => (JSON.parse(message)))
                .filter((message) => (message))
                .reduce((previous, message) => ([...previous, ...message]), [])
        )
    }
    //
    // Otherwise return a format error
    //
    else {
        context.fail(JSON.stringify(`Error: Unknown format ${event}`))
    }

}
