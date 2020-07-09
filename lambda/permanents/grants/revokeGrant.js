// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

exports.revokeGrant = ({ CharacterId, Resource }) => {

    return permanentAndDeltas({
            DeleteRequest: {
                Key: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: `GRANT#${Resource}`
                }
            }
        })
        .then((writes) => (documentClient.batchWrite({ RequestItems: writes }).promise()))
        .then(() => ([{ Grant: { CharacterId, Resource, Revoke: true }}]))

}
