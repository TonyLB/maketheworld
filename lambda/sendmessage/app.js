// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { getRoom } = require('./rooms.js')
const { messageConnectionList } = require('./sockets.js')
const { parseCommand } = require('./parse.js')

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_PREFIX } = process.env;

const connectionTable = `${TABLE_PREFIX}_connections`

exports.handler = async event => {
  
  let nameData
  try {
    nameData = await ddb.get({
      TableName: connectionTable,
      Key: {
        'connectionId': event.requestContext.connectionId
      }
    }).promise();
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
    roomData = await getRoom({ ddb, roomId })
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }
  
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });

  let parseFound = false
  try{
    parseFound = await parseCommand({
      name: nameData && nameData.Item && nameData.Item.name,
      message: JSON.parse(event.body).data,
      roomData: roomData.Item,
      ddb,
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
      message: JSON.parse(event.body).data
    })
  
    try {
      await messageConnectionList({
        connections: roomData.Item.players.map(({ connectionId }) => (connectionId)),
        gatewayAPI: apigwManagementApi,
        ddb,
        postData
      })
    } catch (e) {
      return { statusCode: 500, body: e.stack };
    }
  }

  return { statusCode: 200, body: 'Data sent.' };
};
