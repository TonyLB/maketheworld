// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION })

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
    await ddb.put(connectionPutParams).promise();
  } catch (err) {
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
  }

  let roomData
  try {
    roomData = await ddb.get({ TableName: roomTable, Key: { roomId: 0 }}).promise()
    roomData.Item.players = [
      ...roomData.Item.players,
      {
        name: nameData,
        connectionId: event.requestContext.connectionId
      }
    ]
    await ddb.put({ TableName: roomTable, Item: roomData.Item }).promise()
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
    await apigwManagementApi.postToConnection({ ConnectionId: event.requestContext.connectionId, Data: JSON.stringify(nameReplyData) }).promise();
  } catch (e) {
    return { statusCode: 500, body: e.stack }
  }

  const postData = {
    type: 'sendmessage',
    message: `${nameData} has connected.`
  }
  
  const postCalls = roomData.Item.players.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: JSON.stringify(postData) }).promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: connectionTable, Key: { connectionId } }).promise();
      } else {
        throw e;
      }
    }
  });
  
  try {
    await Promise.all(postCalls);
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  return { statusCode: 200, body: 'Data sent.' };
};
