// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })
const { TABLE_PREFIX, AWS_REGION } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_characters_in_play`

const getCharactersInPlay = () => {

    return documentClient.scan({
            TableName: ephemeraTable
        }).promise()
        .then(({ Items }) => (Items
            .filter(({ ConnectionId }) => (ConnectionId))
            .map(({ ConnectionId, RoomId }) => ({ ConnectionId, RoomId }))
        ))
        .catch((err) => ({ error: err.stack }))

}

exports.handler = (event) => {

    const { action = 'NO-OP' } = event

    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay
        default:
            return { statusCode: 500, error: `Unknown handler key: ${action}`}
    }
}