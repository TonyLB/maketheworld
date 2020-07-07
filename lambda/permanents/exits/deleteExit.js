// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.deleteExit = ({ FromRoomId, ToRoomId }) => {

    return documentClient.delete({
        TableName: permanentTable,
        Key: {
            PermanentId: `ROOM#${FromRoomId}`,
            DataCategory: `EXIT#${ToRoomId}`
        }
    }).promise()
        .then(() => ([{ Exit: { FromRoomId, ToRoomId, Delete: true }}]))

}
