// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('/opt/uuid')

const batchGetDispatcher = (documentClient, ProjectionExpression = 'PermanentId, DataCategory, Ancestry, ProgenitorId') => (items) => {
    const permanentTable = `${process.env.TABLE_PREFIX}_permanents`
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 50) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .map((itemList) => (documentClient.batchGet({ RequestItems: {
            [permanentTable]: {
                Keys: itemList,
                ProjectionExpression: 'PermanentId, #Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId',
                ExpressionAttributeNames: {
                    "#Name": "Name"
                }
            }
        } }).promise()))
    return Promise.all(batchPromises)
        .then((returnVals) => (returnVals.reduce((previous, { Responses }) => ([ ...previous, ...((Responses && Responses[permanentTable]) || []) ]), [])))
}

const batchDispatcher = (documentClient) => (items) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 23) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [`${process.env.TABLE_PREFIX}_permanents`]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

exports.getCharacter = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { CharacterId } = event

    return CharacterId
        ? (documentClient.get({
                TableName: permanentTable,
                Key: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Details'
                }
            }).promise())
            .then(({ Item }) => Item)
            .then(({ Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId }) => ({
                CharacterId, Name, Pronouns, FirstImpression, OneCoolThing, Outfit, HomeId
            }))
            .then(({ CharacterId, ...rest }) => (documentClient.query({
                    TableName: permanentTable,
                    KeyConditionExpression: 'DataCategory = :CharacterId',
                    ExpressionAttributeValues: {
                        ":CharacterId": `CHARACTER#${CharacterId}`
                    },
                    IndexName: "DataCategoryIndex",
                    Limit: 1
                }).promise()
                .then(({ Items }) => (Items))
                .then((Items) => (Items[0]))
                .then(({ PermanentId }) => (PermanentId.split('#').slice(1).join('#')))
                .then((PlayerName) => ({ PlayerName, CharacterId, ...rest }))
            ))
            .catch((err) => ({ error: err.stack }))
        : Promise.resolve({ error: "No CharacterId specified"})

}

exports.getPlayerCharacters = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { PlayerName } = event

    return PlayerName
        ? (documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'PermanentId = :PlayerId AND begins_with(DataCategory, :CharacterId)',
                ExpressionAttributeValues: {
                    ":PlayerId": `PLAYER#${PlayerName}`,
                    ":CharacterId": `CHARACTER#`
                },
            }).promise())
            .then(({ Items }) => Items.map(({ DataCategory }) => (DataCategory.slice(10))))
            .then((Items) => batchGetDispatcher(documentClient)
                (Items.map((characterId) => ({ PermanentId: `CHARACTER#${characterId}`, DataCategory: 'Details' })))
            )
            .then((Items) => (Items.map(({ PermanentId, ...rest }) => ({
                CharacterId: PermanentId.slice(10),
                PlayerName,
                ...rest
            }))))
            .catch((err) => ({ error: err.stack }))
        : Promise.resolve({ error: "No PlayerName specified"})

}

exports.putCharacter = ({
    CharacterId = uuidv4(),
    PlayerName,
    Name,
    Pronouns,
    FirstImpression,
    OneCoolThing,
    Outfit,
    HomeId
}) => {

    const { AWS_REGION } = process.env;

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    return batchDispatcher(documentClient)([{
            PutRequest: {
                Item: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Details',
                    Name,
                    Pronouns,
                    FirstImpression,
                    OneCoolThing,
                    Outfit,
                    HomeId
                }
            }
        },
        {
            PutRequest: {
                Item: {
                    PermanentId: `PLAYER#${PlayerName}`,
                    DataCategory: `CHARACTER#${CharacterId}`
                }
            }
        }])
        .then(() => ({
            CharacterId,
            PlayerName,
            Name,
            Pronouns,
            FirstImpression,
            OneCoolThing,
            Outfit,
            HomeId
        }))
        .catch((err) => ({ error: err.stack }))

}