// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

const { permanentAndDeltas } = require('../delta')

exports.putGrant = ({ CharacterId, Resource, Roles = '', Actions = ''}) => {

    return permanentAndDeltas({
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: `GRANT#${Resource}`,
                    ...(Roles ? { Roles } : {}),
                    ...(Actions ? { Actions } : {})
                }
            }
        })
        .then((writes) => (documentClient.batchWrite({ RequestItems: writes }).promise()))
        .then(() => ([{ Grant: { CharacterId, Resource, Roles, Actions }}]))

}
