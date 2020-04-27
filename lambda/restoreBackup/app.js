// Copyright 2020, Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const s3Get = (filename) => {
    const request = {
        Bucket: process.env.S3_BUCKET,
        Key: filename
    }
    const s3Client = new AWS.S3()
    return s3Client.getObject(request).promise()
}

//
// Deserialize a backup file's format into V1 database format.
//
const deserializeV1 = ({ Neighborhoods, Rooms }) => {
    const NeighborhoodAdds = Object.values(Neighborhoods)
        .map(({
            PermanentId,
            ParentId,
            Ancestry,
            Name,
            Description
        }) => ({
            PutRequest: {
                Item: {
                    permanentId: PermanentId,
                    parentId: ParentId,
                    ancestry: Ancestry,
                    name: Name,
                    description: Description,
                    type: "NEIGHBORHOOD"
                }
            }
        }))
    const RoomAdds = Object.values(Rooms)
        .map(({
            PermanentId,
            ParentId,
            Ancestry,
            Name,
            Description,
        }) => ({
            PutRequest: {
                Item: {
                    permanentId: PermanentId,
                    parentId: ParentId,
                    ancestry: Ancestry,
                    name: Name,
                    description: Description,
                    type: "ROOM"
                }
            }
        }))
    const EntryAdds = Object.values(Rooms)
        .map(({ Entries }) => (Entries.map(({
                PermanentId,
                ParentId,
                Ancestry,
                Name,
                FromRoomId
            }) => ({
                PutRequest: {
                    Item: {
                        permanentId: PermanentId,
                        parentId: ParentId,
                        ancestry: Ancestry,
                        name: Name,
                        fromRoomId: FromRoomId,
                        type: "ENTRY"
                    }
                }
            }))
        ))
        .reduce((previous, entries) => ([ ...previous, ...entries ]), [])
    return [
            ...NeighborhoodAdds,
            ...RoomAdds,
            ...EntryAdds
        ]
}

//
// Deserialize a backup file's format into V2 database format.
//
const deserializeV2 = ({ Neighborhoods, Rooms }) => {
    const NeighborhoodAdds = Object.values(Neighborhoods)
        .map(({
            PermanentId,
            ParentId,
            Ancestry,
            Name,
            Description
        }) => {
            const ancestryList = Ancestry.split(':')
            const ProgenitorRecord = (ancestryList.length > 0) ? { ProgenitorId: ancestryList[0] } : {}
            return {
                PutRequest: {
                    Item: {
                        PermanentId: `NEIGHBORHOOD#${PermanentId}`,
                        DataCategory: 'Details',
                        Name,
                        Description,
                        Ancestry,
                        ParentId,
                        ...ProgenitorRecord
                    }
                }
            }
        })
    const RoomAdds = Object.values(Rooms)
        .map(({
            PermanentId,
            ParentId,
            Ancestry,
            Name,
            Description,
        }) => {
            const ancestryList = Ancestry.split(':')
            const ProgenitorRecord = (ancestryList.length > 0) ? { ProgenitorId: ancestryList[0] } : {}
            return {
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${PermanentId}`,
                        DataCategory: 'Details',
                        Name,
                        Description,
                        ParentId,
                        Ancestry,
                        ...ProgenitorRecord
                    }
                }
            }
        })
    const EntryAdds = Object.values(Rooms)
        .map(({ Entries }) => (Entries.map(({
                ParentId,
                Name,
                FromRoomId
            }) => ({
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${ParentId}`,
                        DataCategory: `ENTRY#${FromRoomId}`,
                        Name: Name
                    }
                }
            }))
        ))
        .reduce((previous, entries) => ([ ...previous, ...entries ]), [])
    const ExitAdds = Object.values(Rooms)
        .map(({ Exits }) => (Exits.map(({
                ParentId,
                Name,
                FromRoomId
            }) => ({
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${FromRoomId}`,
                        DataCategory: `EXIT#${ParentId}`,
                        Name: Name
                    }
                }
            }))
        ))
        .reduce((previous, entries) => ([ ...previous, ...entries ]), [])
    return [
        ...NeighborhoodAdds,
        ...RoomAdds,
        ...EntryAdds,
        ...ExitAdds
    ]
}

const batchDispatcher = (documentClient) => (items) => {
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 23) {
                return {
                    requestLists: [ ...requestLists, current ],
                    current: [item]
                }
            }
            else {
                return {
                    requestLists,
                    current: [...current, item]
                }
            }
        }), { current: [], requestLists: []})
    const batchPromises = [...groupBatches.requestLists, groupBatches.current]
        .map((itemList) => (documentClient.batchWrite({ RequestItems: {
            [`${process.env.TABLE_PREFIX}_permanents`]: itemList
        } }).promise()))
    return Promise.all(batchPromises)
}

exports.handler = (event) => {

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION })

    return s3Get('test.json')
        .then(({ Body }) => Body)
        .then((Body) => Body.toString('utf-8'))
        .then((content) => (JSON.parse(content)))
        .then(deserializeV2)
        .then(batchDispatcher(documentClient))
        .then(() => ({ statusCode: 200, body: 'Restore complete.' }))
        .catch((err) => ({ statusCode: 500, body: err.stack }))
}
