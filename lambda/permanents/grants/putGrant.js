// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

exports.putGrant = ({ CharacterId, Resource, Roles = '', Actions = ''}) => {
    const { TABLE_PREFIX } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    return documentClient.put({
        TableName: permanentTable,
        Item: {
            PermanentId: `CHARACTER#${CharacterId}`,
            DataCategory: `GRANT#${Resource}`,
            ...(Roles ? { Roles } : {}),
            ...(Actions ? { Actions } : {})
        }
    }).promise()
        .then(() => ([{ Grant: { CharacterId, Resource, Roles, Actions }}]))

}
