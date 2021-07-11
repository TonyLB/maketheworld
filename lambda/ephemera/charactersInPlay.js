// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const { DynamoDBClient, QueryCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb')

const { denormalizeCharacter } = require('./denormalize.js')
const { queueAdd } = require('./feedbackQueue.js')

const REGION = process.env.AWS_REGION
const dbClient = new DynamoDBClient({ region: REGION })

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

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
const putCharacterInPlay = async ({ CharacterId, Connected, ConnectionId, ...rest }) => {

    if (!CharacterId) {
        return []
    }
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`

    const requiredFields = ['RoomId', 'Name']
    const optionalFields = ['FirstImpression', 'Pronouns', 'Outfit', 'OneCoolThing']
    const allFields = [...requiredFields, ...optionalFields]
    let expressionAttributes = {}
    let setExpressions = []
    let removeExpressions = []
    let expressionNames
    requiredFields.forEach((key) => {
        if (rest[key]) {
            expressionAttributes[`:${key}`] = rest[key]
            setExpressions = [...setExpressions, `${key === 'Name' ? '#name' : key} = :${key}`]
            if (key === 'Name') {
                expressionNames = {
                    '#name': 'Name'
                }
            }
        }
    })
    optionalFields.forEach((key) => {
        if (rest[key] !== undefined) {
            expressionAttributes[`:${key}`] = rest[key]
            setExpressions = [...setExpressions, `${key} = :${key}`]
        }
    })
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
        ...(expressionNames ? { ExpressionAttributeNames: expressionNames } : {}),
        ReturnValues: 'ALL_NEW'
    }))
    let newRecord = unmarshall(Attributes)
    //
    // Check that the existing ephemera record has all data that should be populated in an
    // ephemera record.  If not, go to the Permanents table to fetch the data that needs to
    // be denormalized.
    //
    if (
        requiredFields.find((key) => (!newRecord[key])) ||
        optionalFields.find((key) => (newRecord[key] === undefined))
    ) {
        newRecord = await denormalizeCharacter({ CharacterId })
    }
    const remap = Object.assign({}, ...(allFields.map((key) => ({ [key]: newRecord[key] }))))
    queueAdd({ CharacterInPlay: {
        ...remap,
        CharacterId,
        Connected: newRecord.Connected
    }})
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
