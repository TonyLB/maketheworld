// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')
const { socketHandler } = require('/opt/sockets')
const { worldHandler } = require('/opt/world')

exports.handler = event => {
  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })
  const world = new worldHandler(sockets)
  const connectionId = event.requestContext.connectionId
  return dbh.getConnection(connectionId)
    .then(({ name, roomId }) => {
      return dbh.getRoom(roomId)
        .then((roomData) => (Promise.all([
          world.removePlayerFromRoom({ roomData, connectionId }),
          dbh.deleteConnection(connectionId),
          world.messageRoomExceptMe({
            roomData,
            postData: JSON.stringify({
              type: 'sendmessage',
              protocol: 'worldMessage',
              message: `${name} has disconnected.`
            })
          })
        ])))
    })
    .then(() => ({ statusCode: 200, body: 'Disconnected.' }))
    .catch((err) => ({ statusCode: 500, body: err.stack }))

};