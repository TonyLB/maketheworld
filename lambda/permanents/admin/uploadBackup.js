// Copyright 2020, Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const { documentClient, s3Client, graphqlClient, gql } = require('utilities')

const s3Put = (filename, contents) => {
    const request = {
        Bucket: process.env.S3_BUCKET,
        Key: filename,
        Body: contents,
        ContentType: 'application/json; charset=utf-8'
    }
    return s3Client.putObject(request).promise()
}

const gqlOutput = `Neighborhood {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
    ContextMapId
    Grants {
      CharacterId
      Actions
      Roles
    }
  }
  Room {
    PermanentId
    Name
    Description
    ParentId
    Visibility
    Topology
    Exits {
      Name
      RoomId
    }
    Entries {
      Name
      RoomId
    }
    Grants {
      CharacterId
      Actions
      Roles
    }
  }
  Map {
    MapId
    Name
    Rooms {
      PermanentId
      X
      Y
      Locked
    }
  }
  Settings {
    ChatPrompt
  }
  Backup {
    PermanentId
    Name
    Description
    Status
  }`

const pendingGQL = ({PermanentId, Name, Description }) => (gql`mutation PendingBackup {
    putBackup (PermanentId: "${PermanentId}", Name: ${JSON.stringify(Name)}, Description: ${JSON.stringify(Description)}, Status: "Creating...") {
        ${gqlOutput}
    }
}`)

const completedGQL = ({PermanentId }) => (gql`mutation PendingBackup {
    putBackup (PermanentId: "${PermanentId}", Status: "Completed.") {
        ${gqlOutput}
    }
}`)

exports.uploadBackup = async ({ body }, context) => {

    let data = body

    const { version, Neighborhoods = [], Rooms = [], Players = [], Name = 'Imported backup', Description = '', ...rest } = data

    if (Object.keys(rest).length) {
        context.fail(JSON.stringify(`Parsing error: Unknown keys ${JSON.stringify(Object.keys(rest))}`))
    }

    if (Neighborhoods.find(({ PermanentId }) => (!PermanentId))) {
        context.fail(JSON.stringify(`Parsing error: Some neighborhoods have no PermanentId`))
    }

    if (Neighborhoods.find(({ Name }) => (!Name))) {
        context.fail(JSON.stringify(`Parsing error: Some neighborhoods have no Name`))
    }

    if (Rooms.find(({ PermanentId }) => (!PermanentId))) {
        context.fail(JSON.stringify(`Parsing error: Some rooms have no PermanentId`))
    }

    if (Rooms.find(({ Name }) => (!Name))) {
        context.fail(JSON.stringify(`Parsing error: Some rooms have no Name`))
    }
    const PermanentId = uuidv4()

    await graphqlClient.mutate({ mutation: pendingGQL({ PermanentId, Name, Description }) })

    const objectName = `backups/${PermanentId}.json`
    return s3Put(objectName, JSON.stringify(body, null, 4))
        .then(() => ({ PermanentId, Name, Description }))

}
