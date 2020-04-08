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

exports.handler = event => {
  const dbh = new dbHandler(process.env)
  const sockets = new socketHandler({ dbh, event })
  const world = new worldHandler(sockets)
  const connectionId = event.requestContext.connectionId

  //
  // Create the mutation:  Make sure that it returns absolutely everything in the schema,
  // because the fields it selects are the fields that will be delivered to subscriptions,
  // and the subscription fields are all REQUIRED by the front end client, so if they
  // are not requested in the mutation then the subscription will fail.
  //
  const mutation = gql`mutation DeleteCharacterInPlay {
    deleteCharacterInPlay(
      ConnectionId: "${connectionId}"
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

  return graphqlClient.mutate({ mutation })
    .then(({ Name, RoomId }) => {
        return Promise.all([
          dbh.deleteConnection(connectionId),
          world.messageRoomExceptMe({
            RoomId,
            postData: JSON.stringify({
              type: 'sendmessage',
              protocol: 'worldMessage',
              message: `${Name} has disconnected.`
            })
          })
        ])
      })
    .then(() => ({ statusCode: 200, body: 'Disconnected.' }))
    .catch((err) => ({ statusCode: 500, body: err.stack }))

};