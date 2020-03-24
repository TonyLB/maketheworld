// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('uuid')
const { dbHandler } = require('/opt/dbHandler')

exports.handler = (event) => {

    const dbh = new dbHandler(process.env)

    const { roomId, ...rawData } = JSON.parse(event.body)
    const roomData = {
        permanentId: roomId || uuidv4(),
        ...rawData
    }

    return dbh.put({
            TableName: dbh.permanentTable,
            Item: roomData
        })
        .then(() => ({ statusCode: 200, body: JSON.stringify({
            roomId: roomData.permanentId,
            ...rawData
        })}))
        //
        // If, anywhere in this process, we encounter uncaught exceptions, we return a fail
        // code with hopefully-useful debug information.
        //
        .catch((err) => {
        return { statusCode: 500, body: 'Failed to write: ' + JSON.stringify(err) };
        })

}
