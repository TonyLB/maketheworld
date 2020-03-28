// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk')

exports.handler = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentsTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const neighborhoodId = event.pathParameters.neighborhoodId

    return documentClient.get({ TableName: permanentsTable, Key: { permanentId: neighborhoodId } })
        .promise()
        .then(({ Item }) => Item)
        .then(({ permanentId, ...rest }) => ({ neighborhoodId: permanentId, ...rest }))
        .then(({ parentId, ...rest }) => (
            (parentId
                ? documentClient.get({
                        TableName: permanentsTable,
                        Key: { permanentId: parentId },
                        AttributeList: ['name']
                    }).promise()
                    .then(({ Item }) => ((Item && Item.name) || ''))
                : Promise.resolve(''))
            .then((parentName) => ({ parentId, parentName, ...rest }))
        ))
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
