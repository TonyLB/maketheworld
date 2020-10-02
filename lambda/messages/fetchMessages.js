const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const messagesTable = `${TABLE_PREFIX}_messages`

const batchGetDispatcher = (items) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length >= 50) {
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
        .map((itemList) => (documentClient.batchGet({ RequestItems: {
            [messagesTable]: {
                Keys: itemList
            }
        } }).promise()))
    return Promise.all(batchPromises)
        .then((returnVals) => (returnVals.reduce((previous, { Responses }) => ([ ...previous, ...((Responses && Responses[messagesTable]) || []) ]), [])))
}

//
// Replaces the "Items" entry in the argument hash by dereferencing (e.g. turning a reference that says 'Character#X received Message#Y at time Z' into Message#Y)
//
exports.fetchMessagesById = async ({ Items = [], ...rest }) => {
    const messageIds = Items.map(({ DataCategory }) => (DataCategory)).filter((value) => (value))
    if (messageIds.length === 0) {
        return []
    }
    const messages = await batchGetDispatcher(messageIds.map((MessageId) => ({ MessageId, DataCategory: 'Content' })))
        .then((items) => (items.map(({ MessageId, DataCategory, ...rest }) => ({
            MessageId: MessageId.split('#').slice(1).join('#'),
            ...rest
        }))))

    return {
        Items: messages.sort(({ CreatedTime: TimeA }, { CreatedTime: TimeB }) => (TimeA - TimeB)),
        ...rest
    }

}
