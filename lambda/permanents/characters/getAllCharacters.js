const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.getAllCharacters = () => {

    return documentClient.scan({
        TableName: `${process.env.TABLE_PREFIX}_permanents`,
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
            if (DataCategory.startsWith('GRANT#')) {
                const Resource = DataCategory.slice(6)
                const Actions = rest.Actions
                const Roles = rest.Roles
                return (Actions || Roles)
                    ? {
                        ...previous,
                        [CharacterId]: {
                            ...(previous[CharacterId] || {}),
                            CharacterId,
                            Grants: [
                                ...((previous[CharacterId] && previous[CharacterId].Grants) || []),
                                {
                                    Resource,
                                    Actions,
                                    Roles
                                }
                            ]
                        }
                    }
                    : previous
            }
            return previous
        }, {})))
        .then((Characters) => (Object.values(Characters)))
}