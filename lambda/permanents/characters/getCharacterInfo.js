const { documentClient } = require('./utilities')

exports.getCharacterInfo = ({ CharacterId }) => (
    documentClient.query({
        TableName: `${process.env.TABLE_PREFIX}_permanents`,
        KeyConditionExpression: 'PermanentId = :CharacterId',
        ExpressionAttributeValues: {
            ":CharacterId": `CHARACTER#${CharacterId}`
        }
    }).promise()
    .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, ...rest }) => {
        if (DataCategory === 'Details') {
            return {
                ...previous,
                CharacterId: PermanentId.slice(10),
                Grants: rest.Grants || previous.Grants || [],
                ...rest
            }
        }
        if (DataCategory.startsWith('GRANT#')) {
            const Resource = DataCategory.slice(6)
            const { Actions, Roles } = rest
            return (Actions || Roles)
                ? {
                    ...previous,
                    Grants: [
                        ...(previous.Grants || []),
                        {
                            Resource,
                            Actions,
                            Roles
                        }
                    ]
                }
                : previous
        }
    }, {})))
)