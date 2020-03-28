// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const AWS = require('aws-sdk');

const { v4: uuidv4 } = require('uuid')

exports.handler = (event) => {

    const { TABLE_PREFIX, AWS_REGION } = process.env;
    const permanentTable = `${TABLE_PREFIX}_permanents`
    const connectionTable = `${TABLE_PREFIX}_players`

    const documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })

    const { roomId, parentId, exits = [], entries = [], ...rawData } = JSON.parse(event.body)
    const roomData = {
        permanentId: roomId || uuidv4(),
        parentId,
        ...rawData
    }

    const getAncestry = parentId
        ? documentClient.get({
                TableName: permanentTable,
                Key: { permanentId: roomData.parentId }
            }).promise()
            .then(({ Item }) => Item)
            .then(({ ancestry }) => `${ancestry}:${roomData.permanentId}`)
        : Promise.resolve(roomData.permanentId)

    //
    // First generate the database form of all of the entries needed in association with
    // this room Put (which is to say, all entries into the room and all entries elsewhere
    // from the room (i.e. exits))
    //
    const setAncestry = ({ permanentId, roomAncestry, ...rest }) => {
        const id = permanentId || uuidv4()
        return {
            ...rest,
            permanentId: id,
            ancestry: `${roomAncestry}:${id}`
        }
    }
    const generatePaths = (roomAncestry) => ({ roomAncestry, paths: [
        ...(exits.map(({ roomId, id, name }) => (setAncestry({
                permanentId: id,
                roomAncestry,
                fromRoomId: roomData.permanentId,
                name,
                parentId: roomId,
                type: 'ENTRY'
            })))),
        ...(entries.map(({ roomId, id, name }) => (setAncestry({
                permanentId: id,
                roomAncestry,
                fromRoomId: roomId,
                name,
                parentId: roomData.permanentId,
                type: 'ENTRY'
            }))))
    ]})

    //
    // Get existing entries to this room
    //
    const existingEntries = documentClient.query({
        TableName: permanentTable,
        IndexName: 'parentIndex',
        KeyConditionExpression: 'parentId = :roomId',
        FilterExpession: 'type = "ENTRY"',
        ExpressionAttributeValues: { ':roomId': roomData.permanentId }
    }).promise()
    .then(({ Items }) => Items)

    //
    // Get existing exits from this room
    //
    const existingExits = documentClient.query({
        TableName: permanentTable,
        IndexName: 'fromRoomIndex',
        KeyConditionExpression: 'fromRoomId = :roomId',
        ExpressionAttributeValues: { ':roomId': roomData.permanentId }
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
    //
    //
    const mergeCommands = Promise.all([getAncestry.then(generatePaths), existingPathMap])
        .then(([{ roomAncestry, paths: incomingPaths}, existingPathMap]) => {
            const pathsToDelete = Object.keys(existingPathMap)
                .filter(key => (!incomingPaths.find(({ permanentId }) => (permanentId === key))))
                .map(key => ({ DeleteRequest: { Key: { permanentId: key } } }))
            const pathsToPut = incomingPaths
                .filter(({ permanentId, parentId, fromRoomId, name }) => (
                    !existingPathMap[permanentId] ||
                    existingPathMap[permanentId].parentId !== parentId ||
                    existingPathMap[permanentId].fromRoomId !== fromRoomId ||
                    existingPathMap[permanentId].name !== name
                ))
                .map(({ permanentId, parentId, name, fromRoomId }) =>
                    ({ permanentId: permanentId || uuidv4(), parentId, name, fromRoomId, type: 'ENTRY' }))
            //
            // Now make sure that we have ancestry information for all paths being put
            //
            const entriesToPut = pathsToPut
                .filter(({ parentId }) => (parentId === roomData.permanentId))
                .map(({ permanentId, ...rest }) => ({
                    permanentId,
                    ...rest,
                    ancestry: `${roomAncestry}:${permanentId}`
                }))
                .map((Item) => ({ PutRequest: { Item }}))

            const exitsToPut = pathsToPut.filter(({ parentId }) => (parentId !== roomData.permanentId))
            const findAncestryForExits = exitsToPut.length
                ? documentClient.batchGet({
                        RequestItems: {
                            [permanentTable]: {
                                Keys: exitsToPut.map(({ fromRoomId }) => ({ 'permanentId': fromRoomId })),
                                ProjectionExpression: 'permanentId, ancestry'
                            }
                        }
                    }).promise()
                    .then(({ Responses }) => Responses[permanentTable])
                    .then((responses) => (responses
                        .map(({ permanentId, ancestry }) => ({ [permanentId]: ancestry }))
                        .reduce((previous, item) => ({ ...previous, ...item }), {})
                    ))
                    .then((roomMap) => (exitsToPut
                        .map(({ permanentId, fromRoomId, ...exit }) => ({
                            permanentId,
                            fromRoomId,
                            ...exit,
                            ancestry: `${roomMap[fromRoomId]}:${permanentId}`
                        }))
                    ))
                    .then((items) => (items.map((Item) => ({ PutRequest: { Item }}))))
                : Promise.resolve([])
            const { parentId, ...roomRest } = roomData
            const roomUpdate = { PutRequest: { Item: {
                ...roomRest,
                ...( parentId ? { parentId } : {}),
                type: 'ROOM',
                ancestry: roomAncestry
            } } }
            return findAncestryForExits
                .then((mappedExitsToPut) => (
                    documentClient.batchWrite({
                        RequestItems: {
                            [permanentTable]: [
                                ...pathsToDelete,
                                ...entriesToPut,
                                ...mappedExitsToPut,
                                roomUpdate
                            ]
                        }
                    }).promise()
                    .then(() => (roomData.permanentId))
                ))
        })

    return mergeCommands
        .then((response) => ({ statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
            },
            body: JSON.stringify(response)
        }))
        //
        // If, anywhere in this process, we encounter uncaught exceptions, we return a fail
        // code with hopefully-useful debug information.
        //
        .catch((err) => {
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': true,
                },
                body: 'Failed to write: ' + JSON.stringify(err)
            }
        })

}
