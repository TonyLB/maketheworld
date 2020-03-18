// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const { TABLE_PREFIX } = process.env;

const connectionTable = `${TABLE_PREFIX}_connections`
const roomTable = `${TABLE_PREFIX}_rooms`

const ddb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

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
    await ddb.put({ TableName: roomTable, Item: {
      ...roomData.Item,
      players: roomData.Item.players.filter(({ connectionId }) => (connectionId !== event.requestContext.connectionId))
    }}).promise()
  } catch (e) {
    return { statusCode: 500, body: e.stack };
  }

  const deleteParams = {
    TableName: connectionTable,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  };

  try {
    await ddb.delete(deleteParams).promise();
  } catch (err) {
    return { statusCode: 500, body: 'Failed to disconnect: ' + JSON.stringify(err) };
  }

  return { statusCode: 200, body: 'Disconnected.' };
};