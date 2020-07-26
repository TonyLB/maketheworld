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
    const CharacterId = await documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'ConnectionId = :ConnectionId and begins_with(EphemeraId, :EphemeraId)',
            ExpressionAttributeValues: {
                ":EphemeraId": "CHARACTERINPLAY#",
                ":ConnectionId": connectionId
            },
            IndexName: 'ConnectionIndex'
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
    const { DataCategory } = await documentClient.get({
            TableName: ephemeraTable,
            Key: {
                EphemeraId,
                DataCategory: 'Connection'
            }
        }).promise()
        .then(({ Item = {} }) => (Item))
    if (DataCategory) {
        await documentClient.update({
            TableName: ephemeraTable,
            Key: {
                EphemeraId,
                DataCategory: 'Connection'
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

    if (routeKey === '$disconnect') {
        return disconnect(connectionId)
    }
    if ((message === 'registercharacter') && CharacterId)
        return registerCharacter({ connectionId, CharacterId})
    return { statusCode: 200, body: JSON.stringify({}) }

}