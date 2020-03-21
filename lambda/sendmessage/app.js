// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')
const { socketHandler } = require('/opt/sockets')
const { worldHandler } = require('/opt/world')
const { parseCommand } = require('./parse.js')


exports.handler = event => {

  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })
  const world = new worldHandler(sockets)

  return dbh.getConnection(event.requestContext.connectionId)
    .then((nameData) => {
      return dbh.getRoom(nameData.roomId)
        .then((roomData) => (
          parseCommand({
            message: JSON.parse(event.body).data,
            playerData: nameData,
            roomData,
            world
          })
          .then((parseFound) => {
            if (parseFound) {
              return
            }
            else {
              const postData = JSON.stringify({
                type: 'sendmessage',
                name: nameData && nameData.name,
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
