// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')

const { TABLE_PREFIX } = process.env;

const roomTable = `${TABLE_PREFIX}_rooms`

const dbh = new dbHandler(process.env)

exports.handler = event => {
  return dbh.getConnection(event.requestContext.connectionId)
    .then((nameData) => {
      return dbh.getRoom(nameData.Item.roomId)
        .then((roomData) => (dbh.put({
          TableName: roomTable,
          Item: {
            ...roomData.Item,
            players: roomData.Item.players.filter(({ connectionId }) => (connectionId !== event.requestContext.connectionId))
          }
        })))
        .then(() => (dbh.deleteConnection(event.requestContext.connectionId)))
    })
    .then(() => ({ statusCode: 200, body: 'Disconnected.' }))
    .catch((err) => ({ statusCode: 500, body: err.stack }))

};