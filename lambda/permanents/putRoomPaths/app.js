// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('/opt/uuid')

exports.handler = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { Entries = [], Exits = [] } = event
    const { PermanentId: SourceRoomId, Ancestry: SourceAncestry } = event.source

    //
    // First generate the database form of all of the entries needed in association with
    // this room Put
    //
    const entriesDBForm = Entries
        .map(({ PermanentId, ...rest }) => ({ PermanentId: PermanentId || uuidv4(), ...rest }))
        .map(({
            PermanentId,
            Name,
            RoomId
        }) => ({
            permanentId: PermanentId,
            parentId: SourceRoomId,
            type: "ENTRY",
            name: Name,
            fromRoomId: RoomId,
            ancestry: SourceAncestry
                ? `${SourceAncestry}:${PermanentId}`
                : PermanentId
        }))

    //
    // Next find the parent rooms for all new entries elsewhere from this room (i.e. exits)
    // so that we can fill in ancestry information where needed.
    //
    const newExits = Exits.filter(({ PermanentId, Ancestry }) => (!(PermanentId && Ancestry)))
    const exitParentLookup = (newExits.length
            ? documentClient.batchGet({
                    RequestItems: {
                        [permanentTable]: {
                            Keys: newExits
                                .filter(({ RoomId }) => (RoomId))
                                .map(({ RoomId }) => ({ 'permanentId': RoomId })),
                            ProjectionExpression: 'permanentId, ancestry'
                        }
                    }
                }).promise()
                .then(({ Responses }) => (Responses[permanentTable]))
            : Promise.resolve([]))
        .then((exitParentList) => (exitParentList.reduce((previous, { permanentId, ancestry }) => ({ ...previous, [permanentId]: ancestry }), {})))

    //
    // Now generate the DBForms of all exits, and fold that together with the DB Form of all
    // entries, to get a DB Form for what the table rows should look like when we're done.
    //
    const desiredPaths = exitParentLookup.then((exitParentMap) => ([
        ...(Exits
                .map((exit) => ({ PermanentId: uuidv4(), ...exit }))
                .map(({ PermanentId, RoomId: ParentId, Ancestry, Name }) => ({
                    permanentId: PermanentId,
                    parentId: ParentId,
                    type: "ENTRY",
                    ancestry: Ancestry ? Ancestry
                        : (ParentId && exitParentMap[ParentId])
                            ? `${exitParentMap[ParentId]}:${PermanentId}`
                            : PermanentId,
                    fromRoomId: SourceRoomId,
                    name: Name
                }))
        ),
        ...entriesDBForm
    ]))

    //
    // Get existing entries to this room
    //
    const existingEntries = documentClient.query({
        TableName: permanentTable,
        IndexName: 'parentIndex',
        KeyConditionExpression: 'parentId = :roomId',
        FilterExpession: 'type = "ENTRY"',
        ExpressionAttributeValues: { ':roomId': SourceRoomId }
    }).promise()
    .then(({ Items }) => Items)

    //
    // Get existing exits from this room
    //
    const existingExits = documentClient.query({
        TableName: permanentTable,
        IndexName: 'fromRoomIndex',
        KeyConditionExpression: 'fromRoomId = :roomId',
        ExpressionAttributeValues: { ':roomId': SourceRoomId }
    }).promise()
    .then(({ Items }) => Items.map(exit => ({ ...exit, type: 'ENTRY' })))

    //
    // Now create a map of all the existing paths, keyed by their ID,
    // so that we can compare incoming paths against that to see whether
    // they are already present (and also to delete where we haven't
    // received any incoming paths)
    //
    const groupPaths = (paths) => (paths
            .map(({ permanentId, ...rest }) => ({ [permanentId]: rest }))
            .reduce((previous, item) => ({ ...previous, ...item }), {})
        )

    const existingPathMap = Promise.all([existingEntries, existingExits])
        .then(([entries, exits]) => ([ ...entries, ...exits ]))
        .then(groupPaths)

    //
    // Figure out the commands that need to be executed in order to change the state we have
    // to the state we want.
    //
    const mergeCommands = Promise.all([desiredPaths, existingPathMap])
        .then(([desiredPaths, existingPathMap]) => {
            const pathsToDelete = Object.keys(existingPathMap)
                .filter(key => (!desiredPaths.find(({ permanentId }) => (permanentId === key))))
                .map(key => ({ DeleteRequest: { Key: { permanentId: key } } }))
            const pathsToPut = desiredPaths
                .filter(({ permanentId, parentId, fromRoomId, name, ancestry }) => (
                    !existingPathMap[permanentId] ||
                    existingPathMap[permanentId].parentId !== parentId ||
                    existingPathMap[permanentId].fromRoomId !== fromRoomId ||
                    existingPathMap[permanentId].name !== name ||
                    existingPathMap[permanentId].ancestry !== ancestry
                ))
                .map((Item) => ({ PutRequest: { Item } }))
            return documentClient.batchWrite({
                    RequestItems: {
                        [permanentTable]: [
                            ...pathsToDelete,
                            ...pathsToPut
                        ]
                    }
                }).promise()
                .then(() => (SourceRoomId))
        })

    return mergeCommands

}
