const AWS = require('aws-sdk');

class dbHandler {
    constructor(processEnv) {
        const { TABLE_PREFIX, AWS_REGION } = processEnv;
        this.permanentTable = `${TABLE_PREFIX}_permanents`
        this.connectionTable = `${TABLE_PREFIX}_players`

        this.documentClient = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: AWS_REGION })
        this.writeQueue = []
    }
    //
    // getRoomRaw:  Gets the entry from the permanents table for a given ID.
    //
    getRoomRaw({ roomId, admin=false }) {
        const nonAdminFetch = this.documentClient.get({ TableName: this.permanentTable, Key: { permanentId: roomId } })
            .promise()
            .then(({ Item: { type, permanentId, ...Item } }) => {
                return this.documentClient.query({
                        TableName: this.permanentTable,
                        IndexName: 'fromRoomIndex',
                        KeyConditionExpression: 'fromRoomId = :roomId',
                        ExpressionAttributeValues: { ':roomId': roomId }
                    }).promise()
                    .then(({ Items }) => (Items.map(({ name, ancestry, parentId, permanentId }) => ({ name, ancestry, roomId: parentId, id: permanentId }))))
                    .then((exits) => ({ ...Item, roomId, exits }))
            })
        if (admin) {
            return nonAdminFetch.then(({ roomId, ...rest }) => {
                    return this.documentClient.query({
                        TableName: this.permanentTable,
                        IndexName: 'parentIndex',
                        KeyConditionExpression: 'parentId = :roomId',
                        FilterExpession: 'type = "ENTRY"',
                        ExpressionAttributeValues: { ':roomId': roomId }
                    }).promise()
                    .then(({ Items }) => (Items.map(({ name, ancestry, permanentId, fromRoomId }) => ({ name, ancestry, id: permanentId, roomId: fromRoomId }))))
                    .then((entries) => ({ roomId, ...rest, entries }))
                })
                .then(({ exits, entries, parentId, ...rest }) => {
                    const roomKeysToFetch = [...(new Set([ ...exits, ...entries ].map(({ roomId }) => roomId)))]
                    return (roomKeysToFetch.length
                        ? this.documentClient.batchGet({
                                RequestItems: {
                                    [this.permanentTable]: {
                                        Keys: roomKeysToFetch.map((key) => ({ 'permanentId': key })),
                                        ProjectionExpression: 'permanentId, #n, ancestry, parentId',
                                        ExpressionAttributeNames: { '#n': 'name' }
                                    }
                                }
                            }).promise()
                            .then(({ Responses }) => Responses[this.permanentTable])
                        : Promise.resolve([]))
                        .then((rooms) => {
                            const neighborhoodKeysToFetch = [...(new Set([
                                    ...(rooms.map(({ parentId }) => parentId)),
                                    parentId
                                ]))]
                                .filter(parentId => parentId)
                            if (!(neighborhoodKeysToFetch.length)) {
                                return { rooms, neighborhoods: [] }
                            }
                            return this.documentClient.batchGet({
                                RequestItems: {
                                    [this.permanentTable]: {
                                        Keys: neighborhoodKeysToFetch.map((key) => ({ 'permanentId': key })),
                                        ProjectionExpression: 'permanentId, #n',
                                        ExpressionAttributeNames: { '#n': 'name' }
                                    }
                                }
                            }).promise()
                            .then(({ Responses }) => Responses[this.permanentTable])
                            .then((neighborhoods) => ({ rooms, neighborhoods }))
                        })
                        .then(({ rooms, neighborhoods }) => ({
                            roomMap: rooms.map(({ permanentId, ancestry, name, parentId }) => ({ [permanentId]: { name, ancestry, parentId }}))
                                .reduce((prev, item) => ({ ...prev, ...item }), {}),
                            neighborhoodMap: neighborhoods.map(({ permanentId, name }) => ({ [permanentId]: name }))
                                .reduce((prev, item) => ({ ...prev, ...item }), {}),

                        }))
                        .then(response => {
                            console.log(response)
                            return response
                        })
                        .then(({ roomMap, neighborhoodMap }) => ({
                            ...rest,
                            parentId,
                            parentName: parentId && neighborhoodMap[parentId],
                            exits: exits.map(({ roomId, ...rest }) => ({
                                ...rest,
                                roomId,
                                roomName: roomMap[roomId].name,
                                roomAncestry: roomMap[roomId].ancestry,
                                roomParentId: roomMap[roomId].parentId,
                                roomParentName: roomMap[roomId].parentId &&
                                    neighborhoodMap[roomMap[roomId].parentId]
                            })),
                            entries: entries.map(({ roomId, ...rest }) => ({
                                ...rest,
                                roomId,
                                roomName: roomMap[roomId].name,
                                roomAncestry: roomMap[roomId].ancestry,
                                roomParentId: roomMap[roomId].parentId,
                                roomParentName: roomMap[roomId].parentId &&
                                    neighborhoodMap[roomMap[roomId].parentId]
                            })),
                        }))
                })
        }
        else {
            return nonAdminFetch
        }
    }

    //
    // getRoom:  Gets the permanents data and merges it with player data.
    //
    getRoom(roomId) {
        return this.getRoomRaw({ roomId })
            .then((roomData) => {
                return this.documentClient.scan({
                    TableName: this.connectionTable,
                    FilterExpression: 'roomId = :roomId',
                    ExpressionAttributeValues: { ':roomId': roomId }
                }).promise()
                .then(({ Items }) => ({
                    ...roomData,
                    players: Items
                }))
            })
    }

    //
    // treeReducer: Takes an in-construction tree and a new element (with ancestry)
    // and recursively builds whatever empty branches are needed to store the information,
    // or fills in information in an empty branch already created.
    //
    treeReducer(previous, { passedAncestry, ancestry, ...item }) {
        const currentAncestry = passedAncestry || ancestry
        if (!currentAncestry) {
            return previous
        }
        const ancestryList = currentAncestry.split(':')
        const remainingAncestry = ancestryList.slice(1).join(':')
        const rootKey = ancestryList[0]
        if (remainingAncestry) {
            const children = this.treeReducer.bind(this)(
                (previous[rootKey] || {}).children || {},
                { passedAncestry: remainingAncestry, ancestry, ...item }
            )
            return {
                ...previous,
                [rootKey]: {
                    permanentId: rootKey,
                    ...(previous[rootKey] || {}),
                    children
                }
            }
        }
        else {
            return {
                ...previous,
                [rootKey]: {
                    ...(previous[rootKey] || {}),
                    ancestry,
                    ...item
                }
            }
        }
    }

    //
    // getAllNeighborhoods: Returns a "table-of-contents" top-level view of the
    // names and IDs of all neighborhoods and rooms in the permanents table.
    //
    getAllNeighborhoods() {
        return this.documentClient.scan({
            TableName: this.permanentTable,
            FilterExpression: '#t = :neighborhood or #t = :room',
            ProjectionExpression: '#t, #n, permanentId, parentId, ancestry',
            ExpressionAttributeNames: {
                '#n': 'name',
                '#t': 'type'
            },
            ExpressionAttributeValues: {
                ':neighborhood': 'NEIGHBORHOOD',
                ':room': 'ROOM'
            }
        }).promise()
        .then(({ Items }) => Items)
        .then(Items => Items.reduce(this.treeReducer.bind(this), {}))
    }

    //
    // getRoomConnections: Get only the connection IDs of players in the room (which
    // are all handily present in the connection table, no need to hit permanents)
    //
    getRoomConnections(roomId) {
        return this.documentClient.scan({
            TableName: this.connectionTable,
            FilterExpression: 'roomId = :roomId',
            ExpressionAttributeValues: { ':roomId': roomId },
            ProjectionExpression: 'connectionId'
        }).promise()
        .then(({ Items }) => Items.map(({ connectionId }) => connectionId))
    }

    //
    // getConnection:  Gets the entry from the connectionss table for a given ID.
    //
    // TODO:  Create a connection class, instantiate that class on fetch, and serialize back out
    // on put.
    //
    getConnection(connectionId) {
        return this.documentClient.get({ TableName: this.connectionTable, Key: { connectionId } })
            .promise()
            .then(({ Item }) => (Item))
    }

    //
    // deleteConnection: Unregisters a broken connection.
    //
    deleteConnection(connectionId) {
        return this.documentClient.delete({ TableName: this.connectionTable, Key: { connectionId } }).promise()
    }

    //
    // TEMP to be replaced by a caching system that groups rights together.
    //
    put(params) {
        return this.documentClient.put(params).promise()
    }

    putConnection(data) {
        return this.put({
            TableName: this.connectionTable,
            Item: data
        })
    }

    //
    // flush:  Puts the items in the writeQueue to the database.
    //
    flush() {
        // TODO
    }
}

exports.dbHandler = dbHandler
