// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, GetItemCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb')

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const promiseDebug = (result) => {
    console.log(result)
    return result
}

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

const getCharactersInPlay = async () => {

    const { Items = [] } = dbClient.send(new QueryCommand({
            TableName: ephemeraTable,
            KeyConditionExpression: 'DataCategory = :DataCategory and begins_with(EphemeraId, :EphemeraId)',
            ExpressionAttributeValues: marshall({
                ":EphemeraId": "CHARACTERINPLAY#",
                ":DataCategory": "Connection"
            }),
            IndexName: 'DataCategoryIndex'
        }))
    return Items.map(unmarshall)
        .map(({ EphemeraId, RoomId, Connected }) => ({
            CharacterId: removeType(EphemeraId),
            RoomId,
            Connected
        }))
}

//
// ConnectionId should only be passed by direct call from Lambda functions
//
const putCharacterInPlay = async ({ CharacterId, RoomId, Connected, ConnectionId }) => {

    if (!CharacterId) {
        return []
    }
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`

    let expressionAttributes = {}
    let setExpressions = []
    let removeExpressions = []
    if (RoomId) {
        expressionAttributes[':RoomId'] = RoomId
        setExpressions = [...setExpressions, 'RoomId = :RoomId']
    }
    if (Connected !== undefined) {
        expressionAttributes[':Connected'] = Connected
        setExpressions = [...setExpressions, 'Connected = :Connected']
    }
    if (ConnectionId) {
        expressionAttributes[':ConnectionId'] = ConnectionId
        setExpressions = [...setExpressions, 'ConnectionId = :ConnectionId']
    }
    else if (ConnectionId !== undefined) {
        removeExpressions = [...removeExpressions, 'ConnectionId']
    }
    const updateExpression = [
        setExpressions.length ? `SET ${setExpressions.join(', ')}`: '',
        removeExpressions.length ? `REMOVE ${removeExpressions.join(', ')}`: '',
    ].filter((value) => (value)).join(' ')
    const { Attributes } = await dbClient.send(new UpdateItemCommand({
        TableName: ephemeraTable,
        Key: marshall({
            EphemeraId,
            DataCategory: 'Connection'
        }),
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: marshall(expressionAttributes),
        ReturnValues: 'ALL_NEW'
    }))
    let newRecord = unmarshall(Attributes)
    if (!newRecord.RoomId) {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            }),
            ProjectionExpression: "RoomId"
        }))
        const { RoomId = 'VORTEX' } = unmarshall(Item)
        const { Attributes: newAttributes } = await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: 'Connection'
            }),
            UpdateExpression: 'SET RoomId = :RoomId',
            ExpressionAttributeValues: marshall({
                ':RoomId': RoomId
            }),
            ReturnValues: 'ALL_NEW'
        }))
        newRecord = unmarshall(newAttributes)
    }
    return [ { CharacterInPlay: {
        CharacterId,
        RoomId: newRecord.RoomId,
        Connected: newRecord.Connected
    }}];
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
