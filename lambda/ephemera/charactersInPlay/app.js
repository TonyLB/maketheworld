// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

exports.getCharactersInPlay = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const ephemeraTable = `${TABLE_PREFIX}_ephemera`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    return documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'DataCategory = :Connection',
            ExpressionAttributeValues: {
                ":Connection": 'Connection'
            },
            IndexName: "DataCategoryIndex"
        }).promise()
        .then(({ Items }) => (Items
            .filter(({ ConnectionId }) => (ConnectionId))
            .map(({ ConnectionId, RoomId }) => ({ ConnectionId, RoomId }))
        ))
        .catch((err) => ({ error: err.stack }))

}

