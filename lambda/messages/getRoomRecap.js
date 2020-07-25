const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const messageTable = `${TABLE_PREFIX}_messages`

exports.getRoomRecap = async (RoomId) => {
    const epochTime = Date.now()
    const messageIds = await documentClient.query({
        TableName: messageTable,
        KeyConditionExpression: 'MessageId = :MessageId and CreatedTime >= :MinTime',
        ExpressionAttributeValues: {
            ":MessageId": `ROOM#${RoomId}`,
            ":MinTime": epochTime - 600000
        },
        IndexName: 'CreatedTimeIndex',
        ScanIndexForward: false,
        Limit: 10
    }).promise()
        .then(({ Items = [] }) => (Items))
        .then((Items) => (Items.map(({ DataCategory }) => (DataCategory))))

    if (messageIds.length === 0) {
        return []
    }
    const messages = await documentClient.batchGet({
        RequestItems: {
            [messageTable]: {
                Keys: messageIds.map((MessageId) => ({ MessageId, DataCategory: 'Content' }))
            }
        }
    }).promise()
        .then(({ Responses }) => ((Responses && Responses[messageTable]) || []))
        .then((items) => (items.map(({ MessageId, DataCategory, ...rest }) => ({
            MessageId: MessageId.split('#').slice(1).join('#'),
            Target: RoomId,
            ...rest
        }))))

    return messages.sort(({ CreatedTime: TimeA }, { CreatedTime: TimeB }) => (TimeA - TimeB))

}