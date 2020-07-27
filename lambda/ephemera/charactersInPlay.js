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
    return documentClient.put({
            TableName: ephemeraTable,
            Item: {
                EphemeraId,
                DataCategory: 'Connection',
                RoomId: newRoomId,
                ...(Connected !== undefined ? { Connected } : { Connected: oldRecord.Connected }),
                ...((Connected && oldRecord && oldRecord.ConnectionId) ? { ConnectionId: oldRecord.ConnectionId } : {})
            }
        }).promise()
        .then(() => ([ { CharacterInPlay: {
            CharacterId,
            RoomId: newRoomId,
            Connected: Connected !== undefined ? Connected : oldRecord.Connected || false
        }}]))
}

const messageGQL = ({ RoomId, Message, Characters }) => (gql`mutation SendMessage {
    updateMessages (Updates: [ { putMessage: { RoomId: "${RoomId}", Message: "${Message}", Characters: [${Characters.map((CharacterId) => (`"${CharacterId}"`)).join(", ")}], MessageId: "${uuidv4()}" }}])
}`)

const disconnectGQL = ({ CharacterId }) => (gql`mutation DisconnectCharacter {
    deleteCharacterInPlay (CharacterId: "${CharacterId}") {
        CharacterId
        RoomId
        Connected
    }
}`)

const disconnectCharacterInPlay = async ({ CharacterId, ConnectionId }) => {
    if (CharacterId && ConnectionId) {
        const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
        const { RoomId, ConnectionId: currentConnectionId } = await documentClient.get({
                TableName: ephemeraTable,
                Key: {
                    EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                    DataCategory: 'Connection'
                }
            }).promise()
            .then(({ Item = {} }) => (Item))

        //
        // If the connection has been replaced because this is a disconnect in close proximity to a reconnect, then
        // do not disconnect the new connection.
        //
        if (currentConnectionId === ConnectionId) {
            const [Characters, { Name = 'Someone' }] = await Promise.all([
                documentClient.query({
                    TableName: ephemeraTable,
                    KeyConditionExpression: 'RoomId = :RoomId',
                    ExpressionAttributeValues: {
                        ":RoomId": RoomId
                    },
                    IndexName: 'RoomIndex'
                }).promise()
                .then(({ Items }) => (Items
                        .filter(({ EphemeraId, Connected }) => (Connected && EphemeraId.startsWith('CHARACTERINPLAY#')))
                        .map(({ EphemeraId }) => (EphemeraId))
                        .map((EphemeraId) => (EphemeraId.split('#').slice(1).join('#')))
                    )),
                documentClient.get({
                    TableName: permanentsTable,
                    Key: {
                        PermanentId: `CHARACTER#${CharacterId}`,
                        DataCategory: 'Details'
                    }
                }).promise()
                .then(({ Item = {} }) => (Item))
            ])
            await Promise.all([
                graphqlClient.mutate({ mutation: messageGQL({
                        RoomId,
                        Characters,
                        Message: `${Name} has disconnected.`
                    })
                }),
                graphqlClient.mutate({ mutation: disconnectGQL({ CharacterId })})
            ])

            return [{ CharacterInPlay: {
                CharacterId,
                RoomId,
                Connected: false
            }}]

        }

        return [{ CharacterInPlay: {
            CharacterId,
            RoomId,
            Connected: true
        }}]

    }

    return []
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
exports.disconnectCharacterInPlay = disconnectCharacterInPlay
