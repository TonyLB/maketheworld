// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient, graphqlClient, gql } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

const disconnectGQL = ({ CharacterId, ConnectionId }) => (gql`mutation DisconnectCharacter {
    disconnectCharacterInPlay (CharacterId: "${CharacterId}", ConnectionId: "${ConnectionId}") {
        CharacterId
        RoomId
        Connected
    }
}`)

const disconnect = async (connectionId) => {
    const CharacterId = await documentClient.scan({
            TableName: ephemeraTable,
            FilterExpression: 'begins_with(EphemeraId, :EphemeraId) and ConnectionId = :ConnectionId',
            ExpressionAttributeValues: {
                ":EphemeraId": "CHARACTERINPLAY#",
                ":ConnectionId": connectionId
            }
        }).promise()
        .then(({ Items = [] }) => (Items[0] || {}))
        .then(({ EphemeraId = '' }) => (removeType(EphemeraId)))

    if (CharacterId) {
        await graphqlClient.mutate({ mutation: disconnectGQL({ CharacterId, ConnectionId: connectionId }) })
    }
    return { statusCode: 200 }
}

const registerCharacter = async ({ connectionId, CharacterId }) => {

    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const DataCategory = await documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'EphemeraId = :EphemeraId and begins_with(DataCategory, :Room)',
            ExpressionAttributeValues: {
                ":EphemeraId": EphemeraId,
                ":Room": "ROOM#"
            }
        }).promise()
        .then(({ Items = [{}] }) => ((Items.length && Items[0]) || {}))
        .then(({ DataCategory }) => (DataCategory))
    if (DataCategory) {
        await documentClient.update({
            TableName: ephemeraTable,
            Key: {
                EphemeraId,
                DataCategory
            },
            UpdateExpression: "set ConnectionId = :ConnectionId",
            ExpressionAttributeValues: {
                ":ConnectionId": connectionId
            }
        }).promise()
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "Registered" })
        }
    }
    return { statusCode: 404 }

}

exports.disconnect = disconnect
exports.registerCharacter = registerCharacter
exports.handler = (event) => {

    const { connectionId, routeKey } = event.requestContext
    const { message, CharacterId = '' } = event.body && JSON.parse(event.body) || {}

    console.log(`Route Key: ${routeKey}`)
    if (routeKey === '$disconnect') {
        console.log(`Disconnecting: ${connectionId}`)
        return disconnect(connectionId)
    }
    if ((message === 'registercharacter') && CharacterId)
        return registerCharacter({ connectionId, CharacterId})
    return { statusCode: 200, body: JSON.stringify({}) }

}