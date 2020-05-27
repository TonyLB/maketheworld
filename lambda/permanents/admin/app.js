// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

exports.getSettings = () => {
    const { TABLE_PREFIX, AWS_REGION } = process.env;

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    return documentClient.get({
        TableName: `${TABLE_PREFIX}_permanents`,
        Key: {
            PermanentId: `ADMIN`,
            DataCategory: 'Details'
        }
    }).promise()
    .then(({ Item = {} }) => (Item))
    .then(({ ChatPrompt = 'What do you do?' }) => ({ ChatPrompt }))
}

exports.putSettings = (payload) => {
    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { ChatPrompt } = payload

    return documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId: 'ADMIN',
                DataCategory: 'Details',
                ChatPrompt
            }
        }).promise()
        .then(() => ([{ Settings: payload }]))

}
