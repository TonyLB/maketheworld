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
        const { RoomId, ConnectionId: currentConnectionId } = await documentClient.query({
                TableName: ephemeraTable,
                KeyConditionExpression: 'EphemeraId = :EphemeraId and begins_with(DataCategory, :Room)',
                ExpressionAttributeValues: {
                    ":EphemeraId": EphemeraId,
                    ":Room": "ROOM#"
                }
            }).promise()
            .then(({ Items }) => (Items && Items[0]))
            .then(({ DataCategory, ConnectionId }) => ({ RoomId: removeType(DataCategory), ConnectionId }))

        //
        // If the connection has been replaced because this is a disconnect in close proximity to a reconnect, then
        // do not disconnect the new connection.
        //
        if (currentConnectionId === ConnectionId) {
            const Characters = await documentClient.query({
                    TableName: ephemeraTable,
                    KeyConditionExpression: 'DataCategory = :DataCategory',
                    ExpressionAttributeValues: {
                        ":DataCategory": `ROOM#${RoomId}`
                    },
                    IndexName: 'DataCategoryIndex'
                }).promise()
                .then(({ Items }) => (Items
                        .filter(({ EphemeraId, Connected }) => (Connected && EphemeraId.startsWith('CHARACTERINPLAY#')))
                        .map(({ EphemeraId }) => (EphemeraId))
                        .map((EphemeraId) => (EphemeraId.split('#').slice(1).join('#')))
                    ))
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
                    Characters,
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

        return {
            CharacterId,
            RoomId,
            Connected: true
        }

    }

    return {}
}

exports.getCharactersInPlay = getCharactersInPlay
exports.putCharacterInPlay = putCharacterInPlay
exports.disconnectCharacterInPlay = disconnectCharacterInPlay
