// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

exports.getGrants = () => {
    const { TABLE_PREFIX } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    return documentClient.scan({
        TableName: permanentTable,
        FilterExpression: 'begins_with(#DataCategory, :Grant)',
        ExpressionAttributeValues: {
            ":Grant": `GRANT#`
        },
        ExpressionAttributeNames: {
            '#DataCategory': 'DataCategory'
        }
    }).promise()
        .then(({ Items }) => (Items.reduce((previous, { DataCategory, PermanentId, ...rest }) => {
            const CharacterId = PermanentId.slice(10)
            if (DataCategory.startsWith('GRANT#')) {
                const Resource = DataCategory.slice(6)
                const Actions = rest.Actions
                const Roles = rest.Roles
                return (Actions || Roles)
                    ? [
                        ...((previous || []).filter(({ CharacterId: filterCharacterId, Resource: filterResource }) => (CharacterId !== filterCharacterId || Resource !== filterResource))),
                        {
                            CharacterId,
                            Resource,
                            Actions,
                            Roles
                        }
                    ]
                    : previous
            }
            return previous
        }, [])))
        .then((Grants) => (Grants.map((grant) => ({ Grant: grant }))))
}