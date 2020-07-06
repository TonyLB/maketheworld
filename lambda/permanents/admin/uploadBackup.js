// Copyright 2020, Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const { documentClient, s3Client, graphqlClient, gql } = require('../utilities')

const s3Put = (filename, contents) => {
    const request = {
        Bucket: process.env.S3_BUCKET,
        Key: filename,
        Body: contents,
        ContentType: 'application/json; charset=utf-8'
    }
    return s3Client.putObject(request).promise()
}

const { gqlOutput } = require('./gqlOutput')

const pendingGQL = ({PermanentId, Name, Description }) => (gql`mutation PendingBackup {
    updatePermanents ( Updates: [ { putBackup: { PermanentId: "${PermanentId}", Name: ${JSON.stringify(Name)}, Description: ${JSON.stringify(Description)}, Status: "Uploading..." } } ]) {
        ${gqlOutput}
    }
}`)

const completedGQL = ({PermanentId }) => (gql`mutation CompletedImport {
    updatePermanents ( Updates: [ { putBackup: { PermanentId: "${PermanentId}", Status: "Uploaded." } } ]) {
        ${gqlOutput}
    }
}`)

exports.uploadBackup = async ({ body }, context) => {

    const { version, Neighborhoods = [], Rooms = [], Players = [], Maps = [], Name = 'Imported backup', Description = '', ...rest } = body

    if (Object.keys(rest).length) {
        context.fail(`Parsing error: Unknown keys ${JSON.stringify(Object.keys(rest))}`)
        return {}
    }

    if (Neighborhoods.find(({ PermanentId }) => (!PermanentId))) {
        context.fail(`Parsing error: Some neighborhoods have no PermanentId`)
        return {}
    }

    if (Neighborhoods.find(({ Name }) => (!Name))) {
        context.fail(`Parsing error: Some neighborhoods have no Name`)
        return {}
    }

    if (Rooms.find(({ PermanentId }) => (!PermanentId))) {
        context.fail(`Parsing error: Some rooms have no PermanentId`)
        return {}
    }

    if (Rooms.find(({ Name }) => (!Name))) {
        context.fail(`Parsing error: Some rooms have no Name`)
        return {}
    }
    const PermanentId = uuidv4()

    await graphqlClient.mutate({ mutation: pendingGQL({ PermanentId, Name, Description }) })

    const objectName = `backups/${PermanentId}.json`
    return s3Put(objectName, JSON.stringify(body, null, 4))
        .then(() => graphqlClient.mutate({ mutation: completedGQL({ PermanentId })}))
        .then(() => ({ PermanentId, Name, Description }))

}
