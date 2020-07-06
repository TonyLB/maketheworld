// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { v4: uuidv4 } = require('/opt/uuid')

const { documentClient } = require('../utilities')

const batchDispatcher = (items) => {
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

exports.putRoom = (event) => {

    const { TABLE_PREFIX } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const { PermanentId, ParentId, Description, Name, Retired = false, Entries = [], Exits = [] } = event.arguments

    const newRoom = !Boolean(PermanentId)

    //
    // First, check existing exits and entries (if any) in order to know which ones are not
    // reflected in this update, and should be removed.
    //
    const pathLookup = newRoom
        ? Promise.resolve({ PermanentId: uuidv4(), Entries, Exits, ParentId, Description, Name, Retired, EntriesToDelete: [], ExitsToDelete: [] })
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
            ParentId,
            Description,
            Name,
            Retired,
            Entries,
            Exits,
            EntriesToDelete: PreviousEntries.filter((entry) => (!Entries.find((check) => (check.RoomId === entry)))),
            ExitsToDelete: PreviousExits.filter((exit) => (!Exits.find((check) => (check.RoomId === exit))))
        }))

    const putRoom = ({
        PermanentId,
        ParentId,
        Name,
        Description,
        Visibility = 'Visible',
        Retired = false,
        Exits,
        Entries,
        ExitsToDelete,
        EntriesToDelete
    }) => (Promise.resolve([
            {
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${PermanentId}`,
                        DataCategory: 'Details',
                        ...(ParentId ? { ParentId } : {}),
                        Name,
                        Description,
                        ...(Retired ? { Retired: 'RETIRED' } : {}),
                        ...(Visibility ? { Visibility } : {})
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
        ])
        .then(batchDispatcher)
        .then(() => ([ { Room: {
            PermanentId,
            ParentId,
            Name,
            Description,
            Visibility,
            Topology: '',
            Grants: [],
            Retired,
            Entries,
            Exits
        }} ]))
    )

    return pathLookup
        .then(putRoom)
        .catch((err) => ({ error: err.stack }))

}
