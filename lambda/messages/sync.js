const { documentClient } = require('./utilities')
const { fetchMessagesById } = require('./fetchMessages')

const { TABLE_PREFIX } = process.env;
const messagesTable = `${TABLE_PREFIX}_messages`
const deltaTable = `${TABLE_PREFIX}_message_delta`

const stripType = (value) => value && value.split('#').slice(1).join('#')

const extractWithDefaults = (defaultMapping) => (args) => (
    Object.entries(defaultMapping).reduce((previous, [key, defaultValue]) => ({ ...previous, [key]: args[key] || defaultValue }), {})
)

const deserialize = ({ DisplayProtocol, MessageId, CreatedTime, ExpirationTime, Target, RoomId, ...rest }) => {

    const globals = { MessageId, CreatedTime, ExpirationTime, DisplayProtocol, Target, RoomId }

    let defaultMapping = {}
    let label = ''

    switch (DisplayProtocol) {

        case 'World':
            label = 'WorldMessage'
            defaultMapping = { Message: '' }
            break

        case 'Player':
            label = 'CharacterMessage'
            defaultMapping = { Message: '', CharacterId: '' }
            break

        case 'Direct':
            label = 'DirectMessage'
            defaultMapping = { Message: '', CharacterId: '', Title: '', Recipients: [] }
            break

        case 'RoomDescription':
            label = 'RoomDescription'
            defaultMapping = {
                RoomId: '',
                Name: '',
                Description: '',
                Ancestry: '',
                Exits: [],
                Characters: []
            }
            break

        case 'Announce':
            label = 'AnnounceMessage'
            defaultMapping = { Message: '', Title: '' }
            break

        default: return globals
    }

    return {
        ...globals,
        [label]: extractWithDefaults(defaultMapping)(rest)
    }
}
const syncRecords = async ({ TargetId, startingAt, limit, exclusiveStartKey }) => {
    if (!startingAt) {
        return []
    }

    const records = await documentClient.query({
        TableName: deltaTable,
        ...(limit ? { Limit: limit } : {}),
        KeyConditionExpression: "Target = :Target and DeltaId >= :Start",
        ExpressionAttributeValues: {
            ":Target": 'CHARACTER#' + TargetId,
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

    const epochTime = Date.now()

    const { LastEvaluatedKey = null, Items = [] } = await (startingAt
        ? syncRecords({ TargetId, startingAt, limit, exclusiveStartKey })
        : documentClient.query({
            TableName: messagesTable,
            KeyConditionExpression: 'MessageId = :TargetId',
            ExpressionAttributeValues: {
                ":TargetId": 'CHARACTER#' + TargetId
            },
            IndexName: 'CreatedTimeIndex',
            ...(limit ? { Limit: limit } : {}),
            ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {})
        }).promise()
            .then(fetchMessagesById))
            //
            // fetchMessagesById strips the DataCategory and Target from the data, so we manually put it back for consistency
            //
            .then(({ Items = [], ...rest }) => ({ ...rest, Items: Items.map((message) => ({ ...message, Target: TargetId, DataCategory: 'Content' }))}))

    return {
        Items: Items.map(deserialize).filter((value) => value),
        LastEvaluatedKey,
        LastSync: LastEvaluatedKey ? null : epochTime,
    }

}
