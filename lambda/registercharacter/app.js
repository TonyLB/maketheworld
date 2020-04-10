// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')
const { socketHandler } = require('/opt/sockets')
const { worldHandler } = require('/opt/world')

const appsync = require('aws-appsync')
const gql = require('graphql-tag')
require('cross-fetch/polyfill')

const graphqlClient = new appsync.AWSAppSyncClient({
  url: process.env.APPSYNC_ENDPOINT_URL,
  region: process.env.AWS_REGION,
  auth: {
    type: 'AWS_IAM',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN
    }
  },
  disableOffline: true
})

exports.handler = (event) => {

  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })
  const world = new worldHandler(sockets)

  const { name, characterId } = JSON.parse(event.body).data
  const playerData = {
    connectionId: event.requestContext.connectionId,
    name,
    CharacterId: characterId,
    roomId: "VORTEX"
  }

  //
  // Create the mutation:  Make sure that it returns absolutely everything in the schema,
  // because the fields it selects are the fields that will be delivered to subscriptions,
  // and the subscription fields are all REQUIRED by the front end client, so if they
  // are not requested in the mutation then the subscription will fail.
  //
  const mutation = gql`mutation AddCharacterInPlay {
    addCharacterInPlay(
      CharacterId: "${characterId}"
      ConnectionId: "${event.requestContext.connectionId}"
    ) {
      CharacterId
      Character {
        PlayerName
        Name
        CharacterId
        Pronouns
        FirstImpression
        Outfit
        OneCoolThing
      }
      RoomId
      ConnectionId
    }
  }`
  //
  // Update the name in the Connection record
  //
  return dbh.putConnection(playerData)
    .then(() => (graphqlClient.mutate({ mutation })))
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
      .then(() => (
        world.sockets.messageToSelf(JSON.stringify({
          type: 'connectionregister',
          connectionId: event.requestContext.connectionId,
          characterId,
          roomId: "VORTEX"
        }))
      ))
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
