// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk')

const { TABLE_PREFIX, AWS_REGION } = process.env;
const permanentTable = `${TABLE_PREFIX}_permanents`

const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

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
