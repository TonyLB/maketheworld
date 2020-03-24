// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')
const { socketHandler } = require('/opt/sockets')
const { worldHandler } = require('/opt/world')

exports.handler = (event) => {

  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })
  const world = new worldHandler(sockets)

  const nameData = JSON.parse(event.body).data
  const playerData = {
    connectionId: event.requestContext.connectionId,
    name: nameData,
    roomId: "VORTEX"
  }
  //
  // Update the name in the Connection record
  //
  return dbh.putConnection(playerData)
    .then(() => (
      //
      // Move the player to the Vortex
      //
      world.movePlayerToRoom({ playerData, roomId: "VORTEX" })
      //
      // Then message everyone there (now including the player) that they have connected.
      //
      .then(() => (world.messageRoom({
          roomId: "VORTEX",
          postData: JSON.stringify({
            type: 'sendmessage',
            protocol: 'worldMessage',
            message: `${playerData.name} has connected.`
          })
        })))
    ))
    .then(() => ({ statusCode: 200, body: 'Data sent.' }))
    //
    // If, anywhere in this process, we encounter uncaught exceptions, we return a fail
    // code with hopefully-useful debug information.
    //
    .catch((err) => {
      return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    })

}
