//
// TODO:  Create message lambda handler to deal with all the in-game and direct messaging.
//
// Rewrite the handler to accept lists of messages, and break them out to individual appSync resolver calls to
// broadcastMessage (in order to trigger subscriptions) for each character receiving.  Bundle all of the resolver
// calls into a single huge appSync wrapper, for performance and minimal turnarounds.
//

// const { sync } = require('./sync')

const { putMessage } = require('./putMessage')
const { getRoomRecap } = require('./getRoomRecap')
const { sync } = require('./sync')
const { documentClient, gql, graphqlClient } = require('./utilities')

const { gqlOutput } = require('./gqlOutput')

const messageTable = `${process.env.TABLE_PREFIX}_messages`
const deltaTable = `${process.env.TABLE_PREFIX}_message_delta`

const batchDispatcher = ({ table, items }) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
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
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [table]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

const gqlGroup = (items) => {
    const mutations = items.map((mutation, index) => (`broadcast${index}: ${mutation}\n`)).join('\n')

    return gql`mutation BroadcastMessages { ${mutations} }`
}

const updateDispatcher = ({ Updates = [] }) => {

    const epochTime = Date.now()

    const outputs = Updates.map((update) => {
            if (update.putMessage) {
                return putMessage({
                    ...update.putMessage,
                    CreatedTime: update.putMessage.CreatedTime || (epochTime + (update.putMessage.TimeOffset || 0))
                })
            }
            return Promise.resolve({})
        }
    )

    return Promise.all(outputs)
        .then((finalOutputs) => finalOutputs.reduce(({
                messageWrites: previousMessageWrites,
                deltaWrites: previousDeltaWrites,
                gqlWrites: previousGQLWrites
            },
            { messageWrites = [], deltaWrites = [], gqlWrites = [] }) => ({
                messageWrites: [ ...previousMessageWrites, ...messageWrites ],
                deltaWrites: [ ...previousDeltaWrites, ...deltaWrites ],
                gqlWrites: [ ...previousGQLWrites, ...gqlWrites ]
            }), {
                messageWrites: [],
                deltaWrites: [],
                gqlWrites: []
            }))
        .then(({ messageWrites, deltaWrites, gqlWrites }) => {
            const gqlGroupOutput = gqlGroup(gqlWrites)
            console.log(gqlGroupOutput)
            return Promise.all([
                batchDispatcher({ table: messageTable, items: messageWrites }),
                batchDispatcher({ table: deltaTable, items: deltaWrites }),
                ...(gqlWrites.length ? [ graphqlClient.mutate({ mutation: gqlGroupOutput }) ] : [])
            ])
        })
}

exports.handler = (event, context) => {
    const { action, Records, ...payload } = event

    //
    // First check for Records, to see whether this is coming from the SNS topic subscription.
    //
    if (Records) {
        return updateDispatcher({
            Updates: Records.filter(({ Sns = {} }) => (Sns.Message))
                .map(({ Sns }) => (Sns.Message))
                .map((message) => (JSON.parse(message)))
                .filter((message) => (message))
        })
    }
    //
    // Next handle direct calls.
    //
    else {

        switch(action) {

            case "sync":
                return sync(payload)

            case "getRoomRecap":
                return getRoomRecap(event.RoomId)

            case "updateMessages":
                return updateDispatcher(payload)

            default:
                context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
        }
    }

}
