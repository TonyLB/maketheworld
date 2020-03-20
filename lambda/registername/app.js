// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')
const { dbHandler } = require('/opt/dbHandler')
const { messageConnectionList } = require('/opt/sockets')

const dbh = new dbHandler(process.env)

const { TABLE_PREFIX } = process.env;

const connectionTable = `${TABLE_PREFIX}_connections`
const roomTable = `${TABLE_PREFIX}_rooms`

exports.handler = async event => {

  const nameData = JSON.parse(event.body).data
  const connectionPutParams = {
    TableName: connectionTable,
    Item: {
      connectionId: event.requestContext.connectionId,
      name: nameData,
      roomId: 0
    }
  };

  try {
    await dbh.put(connectionPutParams)
  } catch (err) {
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
  }

  let roomData
  try {
    roomData = await dbh.getRoom(0)
    roomData.Item.players = [
      ...roomData.Item.players,
      {
        name: nameData,
        connectionId: event.requestContext.connectionId
      }
    ]
    await dbh.put({ TableName: roomTable, Item: roomData.Item })
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }
  
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  
  const nameReplyData = {
    type: 'registername',
    name: nameData
  }
  try {
    await apigwManagementApi.postToConnection({ ConnectionId: event.requestContext.connectionId, Data: JSON.stringify(nameReplyData) }).promise()
  } catch (e) {
    return { statusCode: 500, body: e.stack }
  }

  const postData = JSON.stringify({
    type: 'sendmessage',
    protocol: 'worldMessage',
    message: `${nameData} has connected.`
  })
  
  try {
    await messageConnectionList({
      connections: roomData.Item.players.map(({ connectionId }) => (connectionId)),
      gatewayAPI: apigwManagementApi,
      dbh,
      postData
    })
  } catch (e) {
      return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: 'Data sent.' };
};
