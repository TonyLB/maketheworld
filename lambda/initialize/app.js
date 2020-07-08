// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.handler = async () => {

    //
    // Migrate maps from old format if needed
    //

    const { Items: mapData = [] } = await documentClient.scan({
        TableName: permanentTable,
        FilterExpression: 'begins_with(PermanentId, :Map)',
        ExpressionAttributeValues: {
            ":Map": `MAP#`
        }
    }).promise()

    const mapsToConsolidate = mapData.reduce((previous, {PermanentId: rawPermanentId, DataCategory, Name, X, Y, Locked = false, Rooms = [] }) => {
        const PermanentId = rawPermanentId.slice(4)
        if (DataCategory === 'Details') {
            console.log(`Details: ${PermanentId}`)
            return {
                ...previous,
                [PermanentId]: {
                    ...(previous[PermanentId] || {}),
                    PermanentId,
                    Name,
                    Rooms: [
                        ...(previous[PermanentId] || { Rooms: [] }).Rooms,
                        ...Rooms
                    ]
                }
            }
        }
        if (DataCategory.startsWith('ROOM#')) {
            const RoomId = DataCategory.slice(5)
            console.log(`Room: ${PermanentId} x ${RoomId}`)
            return {
                ...previous,
                [PermanentId]: {
                    ...(previous[PermanentId] || {}),
                    PermanentId,
                    Rooms: [
                        ...(previous[PermanentId] || { Rooms: [] }).Rooms,
                        {
                            PermanentId: RoomId,
                            X,
                            Y,
                            Locked
                        }
                    ]
                }
            }
        }
        return previous
    }, {})
    const mapsToDelete = mapData.filter(({ DataCategory }) => (DataCategory.startsWith('ROOM#')))

    console.log(`Maps To Consolidate: ${JSON.stringify(mapsToConsolidate, null, 4)}`)
    if (mapsToDelete.length) {
        await Promise.all([
            ...(mapsToDelete.map(({ PermanentId, DataCategory }) => (documentClient.delete({
                TableName: permanentTable,
                Key: {
                    PermanentId,
                    DataCategory
                }
            }).promise()))),
            ...(Object.values(mapsToConsolidate || {}).map(({ PermanentId, Name, Rooms }) => (documentClient.put({
                TableName: permanentTable,
                Item: {
                    PermanentId: `MAP#${PermanentId}`,
                    DataCategory: 'Details',
                    Name,
                    Rooms
                }
            }).promise())))
        ])
    }

    //
    // Write required system data
    //

    await documentClient.batchWrite({ RequestItems: {
        [permanentTable]: [
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'ADMIN',
                        DataCategory: 'ROLE#ADMIN',
                        Name: 'Admin',
                        Actions: 'Admin,View,Edit,Moderate,ExtendPrivate,ExtendPublic,ExtendConnected'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'ADMIN',
                        DataCategory: 'ROLE#MODERATOR',
                        Name: 'Moderator',
                        Actions: 'View,Edit,Moderate,ExtendPrivate,ExtendPublic,ExtendConnected'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'ADMIN',
                        DataCategory: 'ROLE#EDITOR',
                        Name: 'Editor',
                        Actions: 'View,Edit,ExtendPrivate,ExtendPublic,ExtendConnected'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'ADMIN',
                        DataCategory: 'ROLE#PLAYER',
                        Name: 'Player',
                        Actions: 'ExtendPrivate'
                    }
                }
            },
            {
                PutRequest: {
                    Item: {
                        PermanentId: 'ADMIN',
                        DataCategory: 'ROLE#VIEWER',
                        Name: 'Viewer',
                        Actions: 'View'
                    }
                }
            }
        ]
    }}).promise()

    const vortex = await documentClient.get({
        TableName: permanentTable,
        Key: {
            PermanentId: 'ROOM#VORTEX',
            DataCategory: 'Details'
        }
    }).promise()
    .then(({ Item = {} }) => (Item))

    if (!(vortex || {}).Name) {
        await documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId: 'ROOM#VORTEX',
                DataCategory: 'Details',
                Name: 'The Vortex',
                Description: 'A swirling pool of flickering energy, barely thick enough to stand on.',
                Visibility: 'Public'
            }
        }).promise()
    }

    const map = await documentClient.get({
        TableName: permanentTable,
        Key: {
            PermanentId: 'MAP#ROOT',
            DataCategory: 'Details'
        }
    }).promise()
    .then(({ Item = {} }) => (Item))

    if (!(map || {}).Name) {
        await documentClient.put({
            TableName: permanentTable,
            Item: {
                PermanentId: 'MAP#ROOT',
                DataCategory: 'Details',
                Name: 'Root Map',
                Rooms: [{
                    PermanentId: 'VORTEX',
                    X: 300,
                    Y: 200
                }]
            }
        }).promise()
    }

    return {
        statusCode: 200,
        message: 'Initialization complete'
    }

}
