// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

exports.revokeGrant = ({ CharacterId, Resource }) => {
    const { TABLE_PREFIX } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    return documentClient.delete({
        TableName: permanentTable,
        Key: {
            PermanentId: `CHARACTER#${CharacterId}`,
            DataCategory: `GRANT#${Resource}`
        }
    }).promise()
        .then(() => ([{ Grant: { CharacterId, Resource, Revoke: true }}]))

}
