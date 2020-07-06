const { documentClient } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.getAllCharacters = () => {

    return documentClient.scan({
        TableName: permanentTable,
        FilterExpression: 'begins_with(#PermanentId, :Character)',
        ExpressionAttributeValues: {
            ":Character": `CHARACTER#`
        },
        ExpressionAttributeNames: {
            '#PermanentId': 'PermanentId'
        }
    }).promise()
        .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, ...rest }) => {
            const CharacterId = PermanentId.slice(10)
            if (DataCategory === 'Details') {
                return {
                    ...previous,
                    [CharacterId]: {
                        ...(previous[CharacterId] || {}),
                        CharacterId,
                        Grants: (previous[CharacterId] && previous[CharacterId].Grants) || [],
                        ...rest
                    }
                }
            }
            return previous
        }, {})))
        .then((Characters) => (Object.values(Characters)))
}