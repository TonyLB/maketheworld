// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

const { TABLE_PREFIX } = process.env;

const connectionTable = `${TABLE_PREFIX}_connections`
const roomTable = `${TABLE_PREFIX}_rooms`

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
      Item: { name: 'Error' }
    }
  }

  const roomId = nameData.Item.roomId
  let roomData
  try {
    roomData = await ddb.get({ TableName: roomTable, Key: { roomId }}).promise()
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }
  
  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });
  
  const postData = JSON.stringify({
    type: 'sendmessage',
    name: nameData && nameData.Item && nameData.Item.name,
    message: JSON.parse(event.body).data
  })
  
  const postCalls = roomData.Item.players.map(async ({ connectionId }) => {
    try {
      await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
    } catch (e) {
      if (e.statusCode === 410) {
        console.log(`Found stale connection, deleting ${connectionId}`);
        await ddb.delete({ TableName: `${TABLE_PREFIX}_connections`, Key: { connectionId } }).promise();
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
