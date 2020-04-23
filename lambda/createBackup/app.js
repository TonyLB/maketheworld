// Copyright 2020, Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const s3Put = (filename, contents) => {
    const request = {
        Bucket: process.env.S3_BUCKET,
        Key: filename,
        Body: contents,
        ContentType: 'application/json; charset=utf-8'
    }
    const s3Client = new AWS.S3()
    return s3Client.putObject(request).promise()
}

exports.handler = (event) => {

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION })

    return documentClient.scan({ TableName: `${process.env.TABLE_PREFIX}_permanents`})
        .promise()
        .then(({ Items }) => (Items))
        //
        // Recast old-style camelCase fields into new-style PascalCase fields
        //
        .then((Items) => (Items.map(({
            ancestry,
            parentId,
            description,
            name,
            type,
            permanentId,
            fromRoomId,
            ...rest
        }) => ({
            Ancestry: ancestry,
            ParentId: parentId,
            Description: description,
            Name: name,
            Type: type,
            PermanentId: permanentId,
            FromRoomId: fromRoomId,
            ...rest
        }))))
        //
        // Break out the neighborhood descriptions in a permanentId keyed map
        //
        .then((Items) => {
            const Neighborhoods = Items.filter(({ Type }) => (Type === 'NEIGHBORHOOD'))
                .reduce((previous, neighborhood) => ({
                    ...previous,
                    [neighborhood.PermanentId]: neighborhood
                }), {})
            return { Neighborhoods, Items }
        })
        //
        // Break out the room descriptions in a permanentId keyed map and
        // create Rooms lists in the neighborhood entries.
        //
        .then(({ Neighborhoods, Items, ...rest }) => {
            const Rooms = Items.filter(({ Type }) => (Type === 'ROOM'))
                .reduce((previous, room) => ({
                    ...previous,
                    [room.PermanentId]: {
                        ...room,
                        Entries: [],
                        Exits: []
                    }
                }), {})
            //
            // Create an updated Neighborhood map
            //
            const newNeighborhoods = Object.values(Rooms)
                .filter(({ ParentId }) => (ParentId && Neighborhoods[ParentId]))
                .reduce((previous, room) => ({
                    ...previous,
                    [room.ParentId]: {
                        ...previous[room.ParentId],
                        Rooms: [
                            ...(previous[room.ParentId].Rooms || []),
                            room.PermanentId
                        ]
                    }
                }), Neighborhoods)
            return { Neighborhoods: newNeighborhoods, Rooms, Items, ...rest }
        })
        //
        // Find all entries and denormalize them into both of the rooms they impact
        //
        .then(({ Items, Rooms, ...rest }) => {
            const Entries = Items.filter(({ Type }) => (Type === 'ENTRY'))
            const newRooms = Entries.filter(({ ParentId, FromRoomId }) => (ParentId && FromRoomId))
                .reduce((previous, entry) => {
                    const { ParentId: ToRoomId, FromRoomId } = entry
                    const fromRoom = previous[FromRoomId] || {}
                    const toRoom = previous[ToRoomId] || {}
                    return {
                        ...previous,
                        ...(fromRoom ? {
                            [FromRoomId]: {
                                ...fromRoom,
                                Exits: [
                                    ...fromRoom.Exits,
                                    entry
                                ]
                            }
                        } : {}),
                        ...(toRoom ? {
                            [ToRoomId]: {
                                ...toRoom,
                                Entries: [
                                    ...toRoom.Entries,
                                    entry
                                ]
                            }
                        } : {})
                    }
                }, Rooms)
            return { Items, Rooms: newRooms, ...rest }
        })
        .then(({ Neighborhoods, Rooms }) => (s3Put('test.json', JSON.stringify({
            version: '2020-04-22',
            Neighborhoods,
            Rooms
        }, null, 4))))
    .then(() => ({ statusCode: 200, body: 'Backup complete.' }))
    .catch((err) => ({ statusCode: 500, body: err.stack }))
}
