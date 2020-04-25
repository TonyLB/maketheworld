// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('/opt/uuid')

exports.handler = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { PermanentId, ParentId, Description, Name, Entries = [], Exits = [] } = event.arguments

    const newRoom = !Boolean(PermanentId)
    const newPermanentId = PermanentId || uuidv4()

    //
    // First find the parent (if any) in the database and derive the Ancestry
    //
    const ancestryLookup = ParentId
        ? documentClient.get({
                TableName: permanentTable,
                Key: {
                    PermanentId: `NEIGHBORHOOD#${ParentId}`,
                    DataCategory: 'Details'
                }
            }).promise()
            .then(({ Item = {} }) => (Item))
            .then(({ Ancestry = '', ProgenitorId = '' }) => ({
                PermanentId: newPermanentId,
                ParentId,
                Description,
                Name,
                Ancestry: `${Ancestry}:${newPermanentId}`,
                ProgenitorId: ProgenitorId || newPermanentId,
                Entries,
                Exits
            }))
        : Promise.resolve({
            PermanentId: newPermanentId,
            ParentId,
            Description,
            Name,
            Ancestry: newPermanentId,
            ProgenitorId: newPermanentId,
            Entries,
            Exits
        })

    //
    // Next, check existing exits and entries (if any) in order to know which ones are not
    // reflected in this update, and should be removed.
    //
    const pathLookup = ({ PermanentId, Entries, Exits, ...rest }) => (
        newRoom ? { PermanentId, Entries, Exits, ...rest, EntriesToDelete: [], ExitsToDelete: [] }
            : documentClient.query({
                TableName: permanentTable,
                KeyConditionExpression: 'PermanentId = :RoomId AND DataCategory BETWEEN :BeforeEntries AND :AfterExits',
                ExpressionAttributeValues: {
                    ':RoomId': `ROOM#${PermanentId}`,
                    ':BeforeEntries': 'EN',
                    ':AfterExits': 'EY'
                }
            }).promise()
            .then(({ Items }) => (Items || []))
            .then((paths) => ({
                PreviousEntries: paths
                    .filter(({ DataCategory }) => (DataCategory.startsWith('ENTRY#')))
                    .map(({ DataCategory }) => (DataCategory.slice(6))),
                PreviousExits: paths
                    .filter(({ DataCategory }) => (DataCategory.startsWith('EXIT#')))
                    .map(({ DataCategory }) => (DataCategory.slice(5)))
            }))
            .then(({ PreviousEntries, PreviousExits }) => ({
                PermanentId,
                Entries,
                Exits,
                ...rest,
                EntriesToDelete: PreviousEntries.filter((entry) => (!Entries.find((check) => (check.RoomId === entry)))),
                ExitsToDelete: PreviousExits.filter((exit) => (!Exits.find((check) => (check.RoomId === exit))))
            }))
    )

    const putRoom = ({
        PermanentId,
        ParentId,
        Ancestry,
        ProgenitorId,
        Name,
        Description,
        Exits,
        Entries,
        ExitsToDelete,
        EntriesToDelete
    }) => (documentClient.batchWrite({
        RequestItems: {
            [permanentTable]: [
                {
                    PutRequest: {
                        Item: {
                            PermanentId: `ROOM#${PermanentId}`,
                            DataCategory: 'Details',
                            ParentId,
                            Ancestry,
                            ProgenitorId,
                            Name,
                            Description
                        }
                    }
                },
                //
                // Delete Exit/Entry pair for all exits that need to be deleted
                //
                ...ExitsToDelete.map((exit) => ([
                    {
                        DeleteRequest: {
                            Key: {
                                PermanentId: `ROOM#${PermanentId}`,
                                DataCategory: `EXIT#${exit}`
                            }
                        }
                    },
                    {
                        DeleteRequest: {
                            Key: {
                                PermanentId: `ROOM#${exit}`,
                                DataCategory: `ENTRY#${PermanentId}`
                            }
                        }
                    },
                ])).reduce((previous, item) => ([ ...previous, ...item ]), []),
                //
                // Delete Entry/Exit pair for all entries that need to be deleted
                //
                ...EntriesToDelete.map((entry) => ([
                    {
                        DeleteRequest: {
                            Key: {
                                PermanentId: `ROOM#${PermanentId}`,
                                DataCategory: `ENTRY#${entry}`
                            }
                        }
                    },
                    {
                        DeleteRequest: {
                            Key: {
                                PermanentId: `ROOM#${entry}`,
                                DataCategory: `EXIT#${PermanentId}`
                            }
                        }
                    },
                ])).reduce((previous, item) => ([ ...previous, ...item ]), []),
                //
                // Put Exit/Entry pair for all exits
                //
                ...Exits.map(({ Name, RoomId }) => ([
                    {
                        PutRequest: {
                            Item: {
                                PermanentId: `ROOM#${PermanentId}`,
                                DataCategory: `EXIT#${RoomId}`,
                                Name
                            }
                        }
                    },
                    {
                        PutRequest: {
                            Item: {
                                PermanentId: `ROOM#${RoomId}`,
                                DataCategory: `ENTRY#${PermanentId}`,
                                Name
                            }
                        }
                    },
                ])).reduce((previous, item) => ([ ...previous, ...item ]), []),
                //
                // Put Entry/Exit pair for all entries
                //
                ...Entries.map(({ Name, RoomId }) => ([
                    {
                        PutRequest: {
                            Item: {
                                PermanentId: `ROOM#${PermanentId}`,
                                DataCategory: `ENTRY#${RoomId}`,
                                Name
                            }
                        }
                    },
                    {
                        PutRequest: {
                            Item: {
                                PermanentId: `ROOM#${RoomId}`,
                                DataCategory: `EXIT#${PermanentId}`,
                                Name
                            }
                        }
                    },
                ])).reduce((previous, item) => ([ ...previous, ...item ]), [])
            ]
        }
    }).promise()
        .then(() => ({
            Type: "ROOM",
            PermanentId,
            ParentId,
            Ancestry,
            ProgenitorId,
            Name,
            Description,
            Entries,
            Exits
        }))
    )

    return ancestryLookup
        .then(pathLookup)
        .then(putRoom)
        .catch((err) => ({ error: err.stack }))

}
