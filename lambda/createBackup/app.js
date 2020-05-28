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

const serializeV2 = (Items) => {

    //
    // Break out the neighborhood descriptions in a permanentId keyed map
    //

    const Neighborhoods = Items.filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('NEIGHBORHOOD#') && DataCategory === 'Details'))
        .map(({ PermanentId, ...rest }) => ({ PermanentId: shearOffFirstTag(PermanentId), ...rest }))
        .reduce((previous, { PermanentId, DataCategory, ProgenitorId, ...rest }) => ({
            ...previous,
            [PermanentId]: {
                PermanentId,
                ...rest
            }
        }), {})

    //
    // Break out the room descriptions in a permanentId keyed map and
    // create Rooms lists in the neighborhood entries.
    //

    const Rooms = Items.filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('ROOM#') && DataCategory === 'Details'))
        .map(({ PermanentId, ...rest }) => ({ PermanentId: shearOffFirstTag(PermanentId), ...rest }))
        .reduce((previous, { PermanentId, DataCategory, ...rest }) => ({
            ...previous,
            [PermanentId]: {
                PermanentId,
                ...rest,
                Entries: [],
                Exits: []
            }
        }), {})

    //
    // Create an updated Neighborhood map with rooms included
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

    //
    // Find all entries and exits
    //

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

    //
    // Break out the players and create Player and Characters lists
    //

    const playerDetails = Items
        .filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('PLAYER#') && (DataCategory === 'Details')))
        .map(({ PermanentId, DataCategory, ...rest }) => ({
            PlayerName: shearOffFirstTag(PermanentId),
            ...rest
        }))
        .reduce((previous, { PlayerName, ...rest }) => ({ ...previous, [PlayerName]: { PlayerName, ...rest } }), {})

    //
    // Break out the characters
    //
    const Characters = Items
        .filter(({ PermanentId, DataCategory }) => (PermanentId.startsWith('CHARACTER#') && (DataCategory === 'Details')))
        .map(({ PermanentId, DataCategory, ...rest }) => ({
            CharacterId: shearOffFirstTag(PermanentId),
            ...rest
        }))
        .reduce((previous, { CharacterId, ...rest }) => ({ ...previous, [CharacterId]: { CharacterId, ...rest } }), {})

    //
    // Nest each character under its player
    //

    const Players = Items
        .filter(({ DataCategory }) => (DataCategory.startsWith('CHARACTER#')))
        .map(({ PermanentId, DataCategory }) => ({
            PlayerName: shearOffFirstTag(PermanentId),
            CharacterId: shearOffFirstTag(DataCategory)
        }))
        .reduce((previous, { PlayerName, CharacterId }) => ({
            ...previous,
            [PlayerName]: {
                ...(previous[PlayerName] || {}),
                Characters: [
                    ...((previous[PlayerName] || {}).Characters || []),
                    ...(Characters[CharacterId] ? [Characters[CharacterId]] : [])
                ]
            }
        }), playerDetails)

    return {
        Neighborhoods: Object.values(newNeighborhoods),
        Rooms: Object.values(newRooms),
        Players: Object.values(Players)
    }

}

exports.handler = (event) => {

    const { objectName } = event

    if (!objectName) {
        return { statusCode: 500, body: 'No objectName provided'}
    }

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION })

    return documentClient.scan({ TableName: `${process.env.TABLE_PREFIX}_permanents`})
        .promise()
        .then(({ Items }) => (Items))
        .then(serializeV2)
        .then(({ Neighborhoods, Rooms, Players }) => (s3Put(objectName, JSON.stringify({
            version: '2020-05-27',
            Neighborhoods,
            Rooms,
            Players
        }, null, 4))))
        .then(() => ({ statusCode: 200, body: 'Backup complete.' }))
        .catch((err) => ({ statusCode: 500, body: err.stack }))

}
