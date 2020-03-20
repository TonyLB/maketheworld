// Copyright 2020, Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { dbHandler } = require('/opt/dbHandler')

exports.handler = event => {
  const dbh = new dbHandler(process.env)
  const putParams = {
    TableName: `${process.env.TABLE_PREFIX}_connections`,
    Item: {
      connectionId: event.requestContext.connectionId
    }
  };

  return dbh.put(putParams)
    .then(() => ({ statusCode: 200, body: 'Connected.' }))
    .catch((err) => ({ statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) }))
}
