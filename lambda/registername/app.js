// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')
const { dbHandler } = require('/opt/dbHandler')
const { socketHandler } = require('/opt/sockets')

const { TABLE_PREFIX } = process.env;

const connectionTable = `${TABLE_PREFIX}_connections`
const roomTable = `${TABLE_PREFIX}_rooms`

exports.handler = (event) => {

  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })

  const nameData = JSON.parse(event.body).data
  const connectionPutParams = {
    TableName: connectionTable,
    Item: {
      connectionId: event.requestContext.connectionId,
      name: nameData,
      roomId: 0
    }
  };

  return dbh.put(connectionPutParams)
    .then(() => (dbh.getRoom(0)))
    .then((roomData) => (roomData.Item))
    .then((roomData) => ({
      ...roomData,
      players: [
        ...roomData.players,
        {
          name: nameData,
          connectionId: event.requestContext.connectionId
        }  
      ]
    }))
    .then((roomData) => {
      //
      // Create three simultaneous updates that need to be executed
      //
      // One, update the room to sync with the data calculated above.
      //
      const updateRoom = dbh.put({ TableName: roomTable, Item: roomData })
      //
      // Two, return a 'registername' type WebSocket call to affirm that the
      // registered name has been received by the system.
      //
      const nameReplyData = {
        type: 'registername',
        name: nameData
      }
      const registerNameWebsocketReturn = sockets.gwAPI.postToConnection({
        ConnectionId: event.requestContext.connectionId,
        Data: JSON.stringify(nameReplyData)
      }).promise()
      //
      // Three, send messages to anyone in the room saying that a player has arrived.
      //
      const postData = JSON.stringify({
        type: 'sendmessage',
        protocol: 'worldMessage',
        message: `${nameData} has connected.`
      })
      const notifyRoom = sockets.messageConnectionList({
        connections: roomData.players.map(({ connectionId }) => (connectionId)),
        postData
      })
      //
      // When and if all of these resolve, we return a success code to the API.
      //
      return Promise.all([
        updateRoom,
        registerNameWebsocketReturn,
        notifyRoom
      ])
      .then(() => ({ statusCode: 200, body: 'Data sent.' }))
    })
    //
    // If, anywhere in this process, we encounter uncaught exceptions, we return a fail
    // code with hopefully-useful debug information.
    //
    .catch((err) => {
      return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    })

}
