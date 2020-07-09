// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

const { permanentAndDeltas } = require('../delta')

exports.deleteExit = ({ FromRoomId, ToRoomId }) => {

    return permanentAndDeltas({
        DeleteRequest: {
            Key: {
                PermanentId: `ROOM#${FromRoomId}`,
                DataCategory: `EXIT#${ToRoomId}`
            }
        }
    })
    .then((writes) => (documentClient.batchWrite({ RequestItems: writes }).promise()))
    .then(() => ([{ Exit: { FromRoomId, ToRoomId, Delete: true }}]))

}
