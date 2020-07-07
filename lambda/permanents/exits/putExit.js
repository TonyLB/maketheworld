// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('../utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.putExit = ({ FromRoomId, ToRoomId, Name }) => {

    return documentClient.put({
        TableName: permanentTable,
        Item: {
            PermanentId: `ROOM#${FromRoomId}`,
            DataCategory: `EXIT#${ToRoomId}`,
            Name
        }
    }).promise()
        .then(() => ([{ Exit: { FromRoomId, ToRoomId, Name }}]))

}
