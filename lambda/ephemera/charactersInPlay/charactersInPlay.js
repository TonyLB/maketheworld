// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient, graphqlClient, gql } = require('./utilities')

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

    return documentClient.scan({
            TableName: ephemeraTable,
            FilterExpression: 'begins_with(EphemeraId, :EphemeraId) and begins_with(DataCategory, :DataCategory)',
            ExpressionAttributeValues: {
                ":EphemeraId": "CHARACTERINPLAY#",
                ":DataCategory": "ROOM#"
            }
        }).promise()
        .then(({ Items = [] }) => (Items.map(({ EphemeraId, DataCategory, Connected }) => ({
            CharacterId: removeType(EphemeraId),
            RoomId: removeType(DataCategory),
            Connected
        }))))
        .catch((err) => ({ error: err.stack }))
}

const putCharacterInPlay = async ({ CharacterId, RoomId, Connected }) => {

    if (!CharacterId) {
        return {}
    }
    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`

    const oldRecord = await documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'EphemeraId = :EphemeraId and begins_with(DataCategory, :Room)',
            ExpressionAttributeValues: {
                ":EphemeraId": EphemeraId,
                ":Room": "ROOM#"
            }
        }).promise()
        .then(({ Items }) => (Items && Items[0]))
    let DataCategory = null
    if (RoomId) {
        DataCategory = `ROOM#${RoomId}`
    }
    if (!DataCategory && oldRecord) {
        DataCategory = oldRecord.DataCategory
    }
    if (!DataCategory) {
        DataCategory = await documentClient.get({
            TableName: permanentsTable,
            Key: {
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            }
        })
            .promise()
            .then(({ Item = {} }) => (Item))
            .then(({ HomeId = '' }) => (`ROOM#${HomeId || 'VORTEX'}`))
    }
    if (oldRecord && (oldRecord.DataCategory !== DataCategory)) {
        await documentClient.delete({
            TableName: ephemeraTable,
            Key: {
                EphemeraId,
                DataCategory: oldRecord.DataCategory
            }
        }).promise()
    }
    return documentClient.put({
            TableName: ephemeraTable,
            Item: {
                EphemeraId,
                DataCategory,
                ...(Connected !== undefined ? { Connected } : { Connected: oldRecord.Connected }),
                ...((Connected && oldRecord && oldRecord.ConnectionId) ? { ConnectionId: oldRecord.ConnectionId } : {})
            }
        }).promise()
        .then(() => ({
            CharacterId,
            RoomId: removeType(DataCategory),
            Connected: Connected !== undefined ? Connected : oldRecord.Connected
        }))
}

const messageGQL = ({ RoomId, Message }) => (gql`mutation SendMessage {
    putRoomMessage (RoomId: "${RoomId}", Message: "${Message}") {
        MessageId
        CreatedTime
        Target
        Message
        RoomId
        CharacterId
        FromCharacterId
        ToCharacterId
        Recap
        ExpirationTime
        Type
        Title
    }
}`)

const disconnectGQL = ({ CharacterId }) => (gql`mutation DisconnectCharacter {
    deleteCharacterInPlay (CharacterId: "${CharacterId}") {
        CharacterId
        RoomId
        Connected
    }
}`)

const disconnectCharacterInPlay = async ({ CharacterId }) => {
    if (CharacterId) {
        const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
        const { RoomId } = await documentClient.query({
                TableName: ephemeraTable,
                KeyConditionExpression: 'EphemeraId = :EphemeraId and begins_with(DataCategory, :Room)',
                ExpressionAttributeValues: {
                    ":EphemeraId": EphemeraId,
                    ":Room": "ROOM#"
                }
            }).promise()
            .then(({ Items }) => (Items && Items[0]))
            .then(({ DataCategory }) => ({ RoomId: removeType(DataCategory) }))
        const { Name = 'Someone' } = await documentClient.get({
                TableName: permanentsTable,
                Key: {
                    PermanentId: `CHARACTER#${CharacterId}`,
                    DataCategory: 'Details'
                }
            }).promise()
            .then(({ Item = {} }) => (Item))
        await graphqlClient.mutate({ mutation: messageGQL({
                RoomId,
                Message: `${Name} has disconnected.`
            })
        })

        await graphqlClient.mutate({ mutation: disconnectGQL({ CharacterId })})
        return {
            CharacterId,
            RoomId,
            Connected: false
        }
    }
    else {
        return {}
    }
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
exports.disconnectCharacterInPlay = disconnectCharacterInPlay
