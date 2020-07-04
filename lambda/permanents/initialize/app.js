// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { documentClient } = require('./utilities')

const { TABLE_PREFIX } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

exports.handler = async () => {

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
        await documentClient.batchWrite({ RequestItems: {
            [permanentTable]: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#ROOT',
                            DataCategory: 'Details',
                            Name: 'Root Map'
                        }
                    }
                },
                {
                    PutRequest: {
                        Item: {
                            PermanentId: 'MAP#ROOT',
                            DataCategory: 'ROOM#VORTEX',
                            X: 300,
                            Y: 200
                        }
                    }
                }
            ]
        }}).promise()
    }

    return {
        statusCode: 200,
        message: 'Initialization complete'
    }

}
