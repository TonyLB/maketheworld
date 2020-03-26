// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')

exports.handler = ( ) => {

    const dbh = new dbHandler(process.env)

    return dbh.getAllNeighborhoods()
        .then((neighborhoodData) => ({
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(neighborhoodData)
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
