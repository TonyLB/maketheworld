// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('/opt/uuid')

exports.handler = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentsTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const neighborhoodData = JSON.parse(event.body)
    const {
        name='',
        description='',
        parentId=''
    } = neighborhoodData
    const permanentId = neighborhoodData.permanentId || uuidv4()

    const findParentAncestry = (neighborhoodData.parentId)
        ? documentClient.get({
                TableName: permanentsTable,
                Key: { permanentId: neighborhoodData.parentId },
                AttributesToGet: ['ancestry']
            }).promise()
            .then(({ Item }) => (Item.ancestry))
        : Promise.resolve('')

    const putNeighborhood = (ancestry) => (documentClient.put({
            TableName: permanentsTable,
            Item: {
                type: 'NEIGHBORHOOD',
                permanentId,
                name,
                ...(description ? { description } : {}),
                ...(parentId ? { parentId } : {}),
                ancestry: ancestry ? `${ancestry}:${permanentId}` : permanentId
            }
        }).promise()
        .then(() => (permanentId))
    )

    return findParentAncestry
        .then(putNeighborhood)
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
                body: 'Failed to write: ' + JSON.stringify(err)
            };
        })

}
