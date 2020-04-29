// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('/opt/uuid')

const batchGetDispatcher = (documentClient) => (items) => {
    const permanentTable = `${process.env.TABLE_PREFIX}_permanents`
    const groupBatches = items.reduce((({ current, requestLists }, item) => {
            if (current.length > 50) {
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
        .map((itemList) => (documentClient.batchGet({ RequestItems: {
            [permanentTable]: {
                Keys: itemList,
                ProjectionExpression: 'PermanentId, DataCategory, Ancestry, ProgenitorId'
            }
        } }).promise()))
    return Promise.all(batchPromises)
        .then((returnVals) => (returnVals.reduce((previous, { Responses }) => ([ ...previous, ...((Responses && Responses[permanentTable]) || []) ]), [])))
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

    const exitRoomLookup = ({ Exits, ...rest }) => (
        (Exits.length
            ? batchGetDispatcher(documentClient)(Exits.map(({ RoomId }) => ({
                    PermanentId: `ROOM#${RoomId}`,
                    DataCategory: 'Details'
                })))
                .then((rooms) => (rooms.reduce((previous, { PermanentId, Ancestry, ProgenitorId }) => ({ ...previous, [PermanentId.slice(5)]: { Ancestry, ProgenitorId } }), {})))
            : Promise.resolve({}))
        .then((RoomLookupsForExits) => ({ Exits, RoomLookupsForExits, ...rest }))
    )

    const putRoom = ({
        PermanentId,
        ParentId,
        Ancestry,
        ProgenitorId,
        Name,
        Description,
        Visibility = 'Visible',
        Exits,
        Entries,
        ExitsToDelete,
        EntriesToDelete,
        RoomLookupsForExits
    }) => (Promise.resolve([
            {
                PutRequest: {
                    Item: {
                        PermanentId: `ROOM#${PermanentId}`,
                        DataCategory: 'Details',
                        ...(ParentId ? { ParentId } : {}),
                        Ancestry,
                        ProgenitorId,
                        Name,
                        Description,
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
                    //
                    // Exits must have the Ancestry and ProgenitorId of their destination room
                    // denormalized into their structure.  This is harder for the exits leading
                    // out of our room ... that's why we had to look these values up prior.
                    //
                    PutRequest: {
                        Item: {
                            PermanentId: `ROOM#${PermanentId}`,
                            DataCategory: `EXIT#${RoomId}`,
                            Name,
                            ...((RoomLookupsForExits && RoomLookupsForExits[RoomId])
                                ? {
                                    Ancestry: RoomLookupsForExits[RoomId].Ancestry,
                                    ProgenitorId: RoomLookupsForExits[RoomId].ProgenitorId
                                }
                                : {})
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
                    //
                    // Exits must have the Ancestry and ProgenitorId of their destination room
                    // denormalized into their structure.  This is easy for the exits leading to
                    // our room (we get those passed as arguments)
                    //
                    PutRequest: {
                        Item: {
                            PermanentId: `ROOM#${RoomId}`,
                            DataCategory: `EXIT#${PermanentId}`,
                            Name,
                            Ancestry,
                            ProgenitorId
                        }
                    }
                },
            ])).reduce((previous, item) => ([ ...previous, ...item ]), [])
        ])
        .then((result) => {
            console.log(JSON.stringify(result, null, 4))
            return result
        })
        .then((writes) => (batchDispatcher(documentClient)(writes)))
        .then(() => ({
            Type: "ROOM",
            PermanentId,
            ParentId,
            Ancestry,
            ProgenitorId,
            Name,
            Description,
            Visibility,
            Entries,
            Exits
        }))
    )

    return ancestryLookup
        .then(pathLookup)
        .then(exitRoomLookup)
        .then((result) => {
            console.log(JSON.stringify(result, null, 4))
            return result
        })
        .then(putRoom)
        .catch((err) => ({ error: err.stack }))

}
