// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')

exports.handler = async event => {
  const dbh = new dbHandler(process.env)
  const putParams = {
    TableName: `${process.env.TABLE_PREFIX}_connections`,
    Item: {
      connectionId: event.requestContext.connectionId
    }
  };

  try {
    await dbh.put(putParams)
  } catch (err) {
    return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
  }

  return { statusCode: 200, body: 'Connected.' };
};
