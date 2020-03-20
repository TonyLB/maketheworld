// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')

const { TABLE_PREFIX } = process.env;

const roomTable = `${TABLE_PREFIX}_rooms`

const dbh = new dbHandler(process.env)

exports.handler = async event => {
  let nameData
  try {
    nameData = await dbh.getConnection(event.requestContext.connectionId)
  } catch (e) {
    nameData = {
      Item: {
        name: 'Error',
        roomId: 0
      }
    }
  }

  const roomId = nameData.Item.roomId
  let roomData
  try {
    roomData = await dbh.getRoom(roomId)
    await dbh.put({ TableName: roomTable, Item: {
      ...roomData.Item,
      players: roomData.Item.players.filter(({ connectionId }) => (connectionId !== event.requestContext.connectionId))
    }})
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  try {
    await dbh.deleteConnection(event.requestContext.connectionId)
  } catch (err) {
    return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
  }

  return { statusCode: 200, body: 'Disconnected.' };
};