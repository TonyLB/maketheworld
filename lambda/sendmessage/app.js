// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { dbHandler } = require('/opt/dbHandler')
const { messageConnectionList } = require('/opt/sockets')
const { parseCommand } = require('./parse.js')


exports.handler = async event => {

  const dbh = new dbHandler(process.env)

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });

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
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }
  
  let parseFound = false
  try{
    parseFound = await parseCommand({
      name: nameData && nameData.Item && nameData.Item.name,
      message: JSON.parse(event.body).data,
      roomData: roomData.Item,
      dbh,
      gatewayAPI: apigwManagementApi,
      connectionId: event.requestContext.connectionId
    })
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  if (!parseFound) {
    const postData = JSON.stringify({
      type: 'sendmessage',
      name: nameData && nameData.Item && nameData.Item.name,
      protocol: 'playerMessage',
      message: JSON.parse(event.body).data
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
  }

  return { statusCode: 200, body: 'Data sent.' };
};
