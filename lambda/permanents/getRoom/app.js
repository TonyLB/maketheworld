// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')

exports.handler = (event) => {

    const dbh = new dbHandler(process.env)

    const roomId = event.pathParameters.roomId

    return dbh.getRoomRaw({ roomId, admin: true })
        .then((roomData) => ({
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(roomData)
        }))
        //
        // If, anywhere in this process, we encounter uncaught exceptions, we return a fail
        // code with hopefully-useful debug information.
        //
        .catch((err) => {
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: 'Failed to read: ' + JSON.stringify(err)
            };
        })

}
