// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
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

  const { characterId } = JSON.parse(event.body).data

  //
  // Create the add mutation:  Make sure that it returns absolutely everything in the schema,
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
      RoomId
      ConnectionId
    }
  }`

  //
  // Create a delete mutation the same way
  //
  const deleteMutation = gql`mutation DeleteCharacterInPlay {
    deleteCharacterInPlay(
      ConnectionId: "${event.requestContext.connectionId}"
    ) {
      CharacterId
      RoomId
      ConnectionId
    }
  }`

  //
  // Update the name in the Connection record
  //
  const gwAPI = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  })

  const messageToSelf = (postData) => {
    return gwAPI.postToConnection({ ConnectionId: event.requestContext.connectionId, Data: postData })
        .promise()
        .catch((e) => {
            if (e.statusCode === 410) {
                console.log(`Found stale connection, deleting ${connectionId}`);
                return graphqlClient.mutate({ deleteMutation })
            } else {
                throw e;
            }
        })
  }

  return graphqlClient.mutate({ mutation })
    .then(() => (
      messageToSelf(JSON.stringify({
        type: 'connectionregister',
        connectionId: event.requestContext.connectionId,
        characterId
      }))
    ))
    .then(() => ({ statusCode: 200, body: 'Data sent.' }))
    //
    // If, anywhere in this process, we encounter uncaught exceptions, we return a fail
    // code with hopefully-useful debug information.
    //
    // .catch((err) => {
    //   return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
    // })

}
