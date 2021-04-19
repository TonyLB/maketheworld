// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient, graphqlClient, gql, SNS } = require('./utilities')
const { v4: uuidv4 } = require('/opt/uuid')

const { TABLE_PREFIX, MESSAGE_SNS_ARN } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_ephemera`
const permanentsTable = `${TABLE_PREFIX}_permanents`

const removeType = (stringVal) => (stringVal.split('#').slice(1).join('#'))

const disconnectGQL = ({ CharacterId, RoomId }) => (gql`mutation DisconnectCharacter {
    broadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: false } }]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const connectGQL = ({ CharacterId, RoomId }) => (gql`mutation ConnectCharacter {
    broadcastEphemera (Ephemera: [{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: true } }]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const updateWithRoomMessage = async ({ promises, CharacterId, RoomId, messageFunction = () => ('Unknown error') }) => {
    const [{ Item: { Name } }, { Items: RoomRecords }] = await Promise.all([
        documentClient.get({
            TableName: permanentsTable,
            Key: {
                PermanentId: `CHARACTER#${CharacterId}`,
                DataCategory: 'Details'
            }
        }).promise(),
        documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'RoomId = :RoomId',
            ExpressionAttributeValues: {
                ':RoomId': RoomId
            },
            IndexName: 'RoomIndex'
        }).promise(),
        ...promises
    ])
    const Characters = [ CharacterId, ...(RoomRecords.filter(({ EphemeraId, Connected }) => (EphemeraId && Connected)).map(({ EphemeraId }) => (removeType(EphemeraId))).filter((checkId) => (checkId !== CharacterId))) ]
    await SNS.publish({
        TopicArn: MESSAGE_SNS_ARN,
        Message: JSON.stringify([{
            Characters,
            DisplayProtocol: "World",
            Message: messageFunction(Name),
            MessageId: uuidv4(),
            RoomId
        }], null, 4)
    }).promise()
}

const disconnect = async (connectionId) => {
    await documentClient.query({
            TableName: ephemeraTable,
            KeyConditionExpression: 'ConnectionId = :ConnectionId and begins_with(EphemeraId, :EphemeraId)',
            ExpressionAttributeValues: {
                ":EphemeraId": "CHARACTERINPLAY#",
                ":ConnectionId": connectionId
            },
            IndexName: 'ConnectionIndex'
        }).promise()
        .then(({ Items = [] }) => (Items
            .map(({ RoomId, EphemeraId = '' }) => ({ CharacterId: removeType(EphemeraId), RoomId }))
            .map(({ CharacterId, RoomId }) => (
                updateWithRoomMessage({
                    RoomId,
                    CharacterId,
                    promises: [
                        documentClient.put({
                            TableName: ephemeraTable,
                            Item: {
                                EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
                                DataCategory: 'Connection',
                                RoomId,
                                Connected: false
                            }
                        }).promise(),
                        graphqlClient.mutate({ mutation: disconnectGQL({ CharacterId, RoomId }) })
                    ],
                    messageFunction: (Name) => (`${Name || 'Someone'} has disconnected.`)
                })
            ))
        ))
        .then(promises => (Promise.all(promises)))

    return { statusCode: 200 }
}

const registerCharacter = async ({ connectionId, CharacterId }) => {

    const EphemeraId = `CHARACTERINPLAY#${CharacterId}`
    const { DataCategory, RoomId, Connected } = await documentClient.get({
            TableName: ephemeraTable,
            Key: {
                EphemeraId,
                DataCategory: 'Connection'
            }
        }).promise()
        .then(({ Item = {} }) => (Item))
    if (DataCategory) {
        const updatePromise = Promise.all([
            documentClient.update({
                TableName: ephemeraTable,
                Key: {
                    EphemeraId,
                    DataCategory: 'Connection'
                },
                UpdateExpression: "set ConnectionId = :ConnectionId, Connected = :Connected",
                ExpressionAttributeValues: {
                    ":ConnectionId": connectionId,
                    ":Connected": true
                }
            }).promise(),
            graphqlClient.mutate({ mutation: connectGQL({ CharacterId, RoomId }) })
        ])
        if (Connected) {
            await updatePromise
        }
        else {
            await updateWithRoomMessage({
                RoomId,
                CharacterId,
                promises: [ updatePromise ],
                messageFunction: (Name) => (`${Name || 'Someone'} has connected.`)
            })
        }
        return {
            statusCode: 200,
            body: JSON.stringify({ messageType: "Registered", CharacterId })
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