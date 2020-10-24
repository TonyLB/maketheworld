const { documentClient } = require('./utilities')
const { fetchMessagesById } = require('./fetchMessages')

const { TABLE_PREFIX } = process.env;
const messagesTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

const stripType = (value) => value && value.split('#').slice(1).join('#')

const syncRecords = async ({ TargetId, startingAt, limit, exclusiveStartKey }) => {
    if (!startingAt) {
        return []
    }

    const records = await documentClient.query({
        TableName: deltaTable,
        ...(limit ? { Limit: limit } : {}),
        KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
        ExpressionAttributeValues: {
            ":Target": TargetId,
            ":Start": `${startingAt}`
        },
        ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
    }).promise()

    const outputRecords = (records.Items || []).map(({ RowId = '', PartitionId, DeltaId = '', TargetId, ...rest }) => {
            const [CreatedTime, MessageId, DataCategory] = DeltaId.split('::')
            return {
                MessageId: stripType(MessageId),
                DataCategory,
                CreatedTime: CreatedTime && parseInt(CreatedTime),
                ...rest
            }
        })
        .filter(({ MessageId, DataCategory, CreatedTime }) => (MessageId && DataCategory && CreatedTime))
    return {
        ...records,
        Items: outputRecords
    }

}

exports.syncRecords = syncRecords

exports.sync = async ({ TargetId, startingAt = null, limit = null, exclusiveStartKey = null }) => {

    console.log('startingAt: ' + startingAt)
    const { LastEvaluatedKey = null, Items = [] } = await (startingAt
        ? syncRecords({ TargetId, startingAt, limit, exclusiveStartKey })
        : documentClient.query({
            TableName: messagesTable,
            KeyConditionExpression: 'MessageId = :TargetId',
            ExpressionAttributeValues: {
                ":TargetId": TargetId
            },
            IndexName: 'CreatedTimeIndex',
            ...(limit ? { Limit: limit } : {}),
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        }).promise()
            .then(fetchMessagesById))
            //
            // fetchMessagesById strips the DataCategory from the data, so we manually put it back for consistency
            //
            .then(({ Items, ...rest }) => ({ ...rest, Items: Items.map((message) => ({ ...message, DataCategory: 'Content' }))}))

    return { Items, LastEvaluatedKey }

}
