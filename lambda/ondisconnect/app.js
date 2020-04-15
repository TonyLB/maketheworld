// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

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
  const connectionId = event.requestContext.connectionId

  //
  // Create the mutation:  Make sure that it returns absolutely everything in the schema,
  // because the fields it selects are the fields that will be delivered to subscriptions,
  // and the subscription fields are all REQUIRED by the front end client, so if they
  // are not requested in the mutation then the subscription will fail.
  //
  const deleteCharacterInPlayMutation = gql`mutation DeleteCharacterInPlay {
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

  return graphqlClient.mutate({ mutation: deleteCharacterInPlayMutation })
    .then(({ data = {} }) => data)
    .then(({ deleteCharacterInPlay = {} }) => deleteCharacterInPlay)
    .then(({ Character = {}, RoomId = '' }) => {
      if (Character.Name && RoomId) {
        const disconnectMessageMutation = gql`mutation DisconnectMessage {
          putRoomMessage(
            RoomId: "${RoomId}",
            Message: "${Character.Name} has disconnected."
          ) {
            MessageId
            CreatedTime
            RoomId
            Message
            FromCharacterId
            Recap
          }
        }`
        return graphqlClient.mutate({ mutation: disconnectMessageMutation })
      }
      return {}
    })
    .then(() => ({ statusCode: 200, body: 'Disconnected.' }))
    .catch((err) => ({ statusCode: 500, body: err.stack }))

};