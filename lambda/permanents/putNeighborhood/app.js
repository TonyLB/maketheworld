// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('/opt/uuid')

exports.handler = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { PermanentId, ParentId, Description, Name } = event.arguments

    const newPermanentId = PermanentId || uuidv4()

    //
    // First find the parent (if any) in the database and derive the Ancestry
    //
    const ancestryLookup = ParentId
        ? documentClient.get({
                TableName: permanentTable,
                Key: {
                    PermanentId: `NEIGHBORHOOD#${ParentId}`,
                    DataCategory: 'Details'
                }
            }).promise()
            .then(({ Item = {} }) => (Item))
            .then(({ Ancestry = '', ProgenitorId = '' }) => ({
                PermanentId: newPermanentId,
                ParentId,
                Description,
                Name,
                Ancestry: `${Ancestry}:${newPermanentId}`,
                ProgenitorId: ProgenitorId || newPermanentId
            }))
        : Promise.resolve({
            PermanentId: newPermanentId,
            ParentId,
            Description,
            Name,
            Ancestry: newPermanentId,
            ProgenitorId: newPermanentId
        })

    const putNeighborhood = ({
        PermanentId,
        ParentId,
        Ancestry,
        ProgenitorId,
        Name,
        Description
    }) => (documentClient.put({
        TableName: permanentTable,
        Item: {
            PermanentId: `NEIGHBORHOOD#${PermanentId}`,
            DataCategory: 'Details',
            ParentId,
            Ancestry,
            ProgenitorId,
            Name,
            Description
        },
        ReturnValues: "ALL_OLD"
    }).promise()
        .then((old) => ((old && old.Attributes) || {}))
        .then(({ DataCategory, ...rest }) => ({
            ...rest,
            Type: "NEIGHBORHOOD",
            PermanentId,
            ParentId,
            Ancestry,
            ProgenitorId,
            Name,
            Description
        }))
    )

    return ancestryLookup
        .then(putNeighborhood)
        .catch((err) => ({ error: err.stack }))

}
