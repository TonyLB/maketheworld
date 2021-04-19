//
// TODO:  Refactor to us v3 @aws-sdk/client-dynamoDB for smaller bundle size
//
const AWS = require('aws-sdk')

const { putMessage } = require('./putMessage')

const { AWS_REGION } = process.env;

const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

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

exports.handler = (event, context) => {
    const { action, Records, ...payload } = event

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
