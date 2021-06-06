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
    //
    // Check that the existing ephemera record has all data that should be populated in an
    // ephemera record.  If not, go to the Permanents table to fetch the data that needs to
    // be denormalized.
    //
    const requiredFields = ['RoomId', 'Name']
    const optionalFields = ['FirstImpression', 'Pronouns', 'Outfit', 'OneCoolThing']
    const allFields = [...requiredFields, ...optionalFields]
    if (
        requiredFields.filter((key) => (!newRecord[key])) ||
        optionalFields.filter((key) => (newRecord[key] === undefined))
    ) {
        const { Item } = await dbClient.send(new GetItemCommand({
            TableName: permanentsTable,
            Key: marshall({
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            }),
            ProjectionExpression: allFields.map((key) => (key === 'Name' ? '#name' : key)).join(', '),
            ExpressionAttributeNames: { '#name': 'Name' }
        }))
        const fromCharacterPermanent = unmarshall(Item)
        const newExpressionAttributes = Object.assign({}, ...(allFields.filter((key) => fromCharacterPermanent[key]).map((key) => ({ [`:${key}`]: fromCharacterPermanent[key] }))))
        const newUpdateExpression = allFields.filter((key) => fromCharacterPermanent[key]).map((key) => (`${key === 'Name' ? '#name' : key} = :${key}`)).join(', ')
        const { Attributes: newAttributes } = await dbClient.send(new UpdateItemCommand({
            TableName: ephemeraTable,
            Key: marshall({
                EphemeraId,
                DataCategory: 'Connection'
            }),
            UpdateExpression: `SET ${newUpdateExpression}`,
            ExpressionAttributeValues: marshall(newExpressionAttributes),
            ExpressionAttributeNames: { '#name': 'Name' },
            ReturnValues: 'ALL_NEW'
        }))
        newRecord = unmarshall(newAttributes)
    }
    const remap = Object.assign({}, ...(allFields.map((key) => ({ [key]: newRecord[key] }))))
    return [ { CharacterInPlay: {
        CharacterId,
        Connected: newRecord.Connected,
        ...remap
    }}];
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
