// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

const { permanentAndDeltas } = require('../delta')

exports.putExit = ({ FromRoomId, ToRoomId, Name }) => {

    return permanentAndDeltas({
            PutRequest: {
                Item: {
                    PermanentId: `ROOM#${FromRoomId}`,
                    DataCategory: `EXIT#${ToRoomId}`,
                    Name
                }
            }
        })
        .then((writes) => (documentClient.batchWrite({ RequestItems: writes }).promise()))
        .then(() => ([{ Exit: { FromRoomId, ToRoomId, Name }}]))

}
