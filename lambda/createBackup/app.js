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

const shearOffFirstTag = (item) => (item.split('#').slice(1).join('#'))

const serializeV1 = (Items) => (
    Promise.resolve(Items)
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
)

const serializeV2 = (Items) => (
    Promise.resolve(Items)
        //
        // Break out the neighborhood descriptions in a permanentId keyed map
        //
        .then((Items) => {
            const Neighborhoods = Items.filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('NEIGHBORHOOD#') && DataCategory === 'Details'))
                .map(({ PermanentId, ...rest }) => ({ PermanentId: shearOffFirstTag(PermanentId), ...rest }))
                .reduce((previous, { PermanentId, DataCategory, ProgenitorId, ...rest }) => ({
                    ...previous,
                    [PermanentId]: {
                        PermanentId,
                        ...rest
                    }
                }), {})
            return { Neighborhoods, Items }
        })
        //
        // Break out the room descriptions in a permanentId keyed map and
        // create Rooms lists in the neighborhood entries.
        //
        .then(({ Neighborhoods, Items, ...rest }) => {
            const Rooms = Items.filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('ROOM#') && DataCategory === 'Details'))
                .map(({ PermanentId, ...rest }) => ({ PermanentId: shearOffFirstTag(PermanentId), ...rest }))
                .reduce((previous, { PermanentId, DataCategory, ProgenitorId, ...rest }) => ({
                    ...previous,
                    [PermanentId]: {
                        PermanentId,
                        ...rest,
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
        // Find all entries and exits
        //
        .then(({ Items, Rooms, ...rest }) => {
            const Entries = Items.filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('ROOM#') && (DataCategory.startsWith('ENTRY#') || DataCategory.startsWith('EXIT#'))))
            const newRooms = Entries.map(({ PermanentId, DataCategory, ...rest }) => ({
                    ParentId: shearOffFirstTag(PermanentId),
                    RoomId: shearOffFirstTag(DataCategory),
                    Type: DataCategory.split('#')[0],
                    ...rest
                }))
                .filter(({ ParentId, RoomId }) => (ParentId && RoomId))
                .reduce((previous, entry) => {
                    const { ParentId, Type, ProgenitorId, Ancestry, RoomId, ...rest } = entry
                    const toRoom = previous[ParentId] || {}
                    return {
                        ...previous,
                        ...(toRoom ? {
                            [toRoom.PermanentId]: {
                                ...toRoom,
                                ...(Type === 'ENTRY'
                                    ? { Entries: [
                                        ...toRoom.Entries,
                                        {
                                            ParentId,
                                            FromRoomId: RoomId,
                                            ...rest
                                        }
                                    ]}
                                    : Type === 'EXIT'
                                        ? { Exits: [
                                            ...toRoom.Exits,
                                            {
                                                ParentId: RoomId,
                                                FromRoomId: ParentId,
                                                ...rest
                                            }
                                        ]}
                                        : {})
                            }
                        } : {})
                    }
                }, Rooms)
            return { Items, Rooms: newRooms, ...rest }
        })
)
exports.handler = (event) => {

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION })

    return documentClient.scan({ TableName: `${process.env.TABLE_PREFIX}_permanents`})
        .promise()
        .then(({ Items }) => (Items))
        .then(serializeV2)
        .then(({ Neighborhoods, Rooms }) => (
            documentClient.scan({
                TableName: `${process.env.TABLE_PREFIX}_players`
            }).promise()
            .then(({ Items }) => ({ Items, Players: {} }))
            //
            // Break out the player records in a PlayerName keyed map
            //
            .then(({ Items, Players }) => ({
                Items,
                Players: {
                    ...Players,
                    ...(Items.filter(({ DataCategory }) => (DataCategory === 'Details'))
                        .map(({ PlayerName, DataCategory, ...rest }) => ({
                            PlayerName,
                            ...rest
                        }))
                        .reduce((previous, player) => ({
                            ...previous,
                            [player.PlayerName]: player
                        }), {})
                    )
                }
            }))
            //
            // Nest each character under its player
            //
            .then(({ Items, Players }) => ({
                Items,
                Players: Items.filter(({ DataCategory }) => (DataCategory.startsWith('Character#')))
                    .reduce((previous, { PlayerName, DataCategory, CharacterId, ...rest }) => ({
                        ...previous,
                        [PlayerName]: {
                            ...(previous[PlayerName] || {}),
                            Characters: [
                                ...((previous[PlayerName] || {}).Characters || []),
                                {
                                    CharacterId: shearOffFirstTag(DataCategory),
                                    ...rest
                                }
                            ]
                        }
                    }), Players)
            }))
            .then(({ Players }) => ({ Neighborhoods, Rooms, Players }))
        ))
        .then(({ Neighborhoods, Rooms, Players }) => (s3Put('test.json', JSON.stringify({
            version: '2020-05-02',
            Neighborhoods,
            Rooms,
            Players
        }, null, 4))))
        .then(() => ({ statusCode: 200, body: 'Backup complete.' }))
        .catch((err) => ({ statusCode: 500, body: err.stack }))
}
