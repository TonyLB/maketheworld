// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const { TABLE_PREFIX, AWS_REGION } = process.env;
const ephemeraTable = `${TABLE_PREFIX}_characters_in_play`
const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

const promiseDebug = (result) => {
    console.log(result)
    return result
}

const getCharactersInPlay = () => {

    return documentClient.scan({
            TableName: ephemeraTable
        }).promise()
        .then(({ Items }) => (Items
            .filter(({ ConnectionId }) => (ConnectionId))
            .map(({ CharacterId, ConnectionId, RoomId }) => ({ CharacterId, ConnectionId, RoomId }))
        ))
        .catch((err) => ({ error: err.stack }))

}

const putCharacterInPlay = ({ CharacterId, ConnectionId, RoomId }) => {

    return documentClient.get({
            TableName: ephemeraTable,
            Key: {
                CharacterId
            }
        }).promise()
        .then(({ Item = {} }) => ({
            ...Item,
            CharacterId,
            ...(ConnectionId ? { ConnectionId } : {}),
            ...(RoomId ? { RoomId } : {}),
        }))
        .then((Item) => {
            if (!Item.RoomId) {
                return documentClient.get({
                        TableName: `${TABLE_PREFIX}_permanents`,
                        Key: {
                            PermanentId: `CHARACTER#${CharacterId}`,
                            DataCategory: 'Details'
                        }
                    }).promise()
                    .then(({ Items }) => (Items || {}))
                    .then(({ HomeId = 'VORTEX' }) => ({ ...Item, RoomId }) )
            }
            else {
                return Item
            }
        })
        .then((Item) => {
            return documentClient.put({
                TableName: ephemeraTable,
                Item
            }).promise()
            .then(() => (Item))
        })
}

exports.handler = (event) => {

    const { action = 'NO-OP' } = event

    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay()
        case 'putCharacterInPlay':
            return putCharacterInPlay({
                CharacterId: event.CharacterId,
                ConnectionId: event.ConnectionId,
                RoomId: action.RoomId
            })
        default:
            return { statusCode: 500, error: `Unknown handler key: ${action}`}
    }
}