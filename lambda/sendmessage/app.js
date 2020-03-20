// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')
const { socketHandler } = require('/opt/sockets')
const { parseCommand } = require('./parse.js')


exports.handler = event => {

  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })

  return dbh.getConnection(event.requestContext.connectionId)
    .then((nameData) => {
      return dbh.getRoom(nameData.Item.roomId)
        .then((roomData) => (roomData.Item))
        .then((roomData) => (
          parseCommand({
            name: nameData && nameData.Item && nameData.Item.name,
            message: JSON.parse(event.body).data,
            roomData,
            dbh,
            sockets,
            connectionId: event.requestContext.connectionId
          })
          // Promise.resolve(true)
          .then((parseFound) => {
            if (parseFound) {
              return Promise.resolve(true)
            }
            else {
              const postData = JSON.stringify({
                type: 'sendmessage',
                name: nameData && nameData.Item && nameData.Item.name,
                protocol: 'playerMessage',
                message: JSON.parse(event.body).data
              })
              return sockets.messageConnectionList({
                connections: roomData.players.map(({ connectionId }) => (connectionId)),
                postData
              })
            }
          })
        ))
    })
    .then(() => ({ statusCode: 200, body: 'Data sent.' }))
    .catch((e) => ({ statusCode: 500, body: e.stack }))

};
