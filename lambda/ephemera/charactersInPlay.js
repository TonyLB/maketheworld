// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient, graphqlClient, gql } = require('./utilities')

const { v4: uuidv4 } = require('/opt/uuid')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const promiseDebug = (result) => {
    console.log(result)
    return result
}

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

const updateMap = (previous, { CharacterId, ...rest }) => ({
    ...previous,
    [CharacterId]: {
        CharacterId,
        ...(previous[CharacterId] || {}),
        ...rest
    }
})

const getCharactersInPlay = () => {

    return documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'DataCategory = :DataCategory and begins_with(EphemeraId, :EphemeraId)',
            ExpressionAttributeValues: {
                ":EphemeraId": "CHARACTERINPLAY#",
                ":DataCategory": "Connection"
            },
            IndexName: 'DataCategoryIndex'
        }).promise()
        .then(({ Items = [] }) => (Items.map(({ EphemeraId, RoomId, Connected }) => ({
            CharacterId: removeType(EphemeraId),
            RoomId,
            Connected
        }))))
}

const putCharacterInPlay = async ({ CharacterId, RoomId, Connected }) => {

    if (!CharacterId) {
        return []
    }
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`

    const oldRecord = await documentClient.get({
            TableName: ephemeraTable,
            Key: {
                EphemeraId,
                DataCategory: 'Connection'
            }
        }).promise()
        .then(({ Item = {} }) => (Item))
    let newRoomId = null
    if (RoomId) {
        newRoomId = RoomId
    }
    if (!newRoomId && oldRecord) {
        newRoomId = oldRecord.RoomId
    }
    if (!newRoomId) {
        newRoomId = await documentClient.get({
            TableName: permanentsTable,
            Key: {
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            }
        })
            .promise()
            .then(({ Item = {} }) => (Item))
            .then(({ HomeId = '' }) => (HomeId || 'VORTEX'))
    }
    const newConnected = (Connected !== undefined) ? Connected : oldRecord.Connected
    return documentClient.put({
            TableName: ephemeraTable,
            Item: {
                EphemeraId,
                DataCategory: 'Connection',
                RoomId: newRoomId,
                Connected: newConnected,
                ...((newConnected && oldRecord && oldRecord.ConnectionId) ? { ConnectionId: oldRecord.ConnectionId } : {})
            }
        }).promise()
        .then(() => ([ { CharacterInPlay: {
            CharacterId,
            RoomId: newRoomId,
            Connected: Connected !== undefined ? Connected : oldRecord.Connected || false
        }}]))
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
