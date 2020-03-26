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
                    .then(({ Items }) => (Items.map(({ name, parentId, permanentId }) => ({ name, roomId: parentId, id: permanentId }))))
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
                    .then(({ Items }) => (Items.map(({ name, permanentId, fromRoomId }) => ({ name, id: permanentId, roomId: fromRoomId }))))
                    .then((entries) => ({ roomId, ...rest, entries }))
                })
                .then(({ exits, entries, parentId, ...rest }) => {
                    const roomKeysToFetch = [...(new Set([ ...exits, ...entries ].map(({ roomId }) => roomId)))]
                    return (roomKeysToFetch.length
                        ? this.documentClient.batchGet({
                                RequestItems: {
                                    [this.permanentTable]: {
                                        Keys: roomKeysToFetch.map((key) => ({ 'permanentId': key })),
                                        ProjectionExpression: 'permanentId, #n, parentId',
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
                            roomMap: rooms.map(({ permanentId, name, parentId }) => ({ [permanentId]: { name, parentId }}))
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
                                roomParentId: roomMap[roomId].parentId,
                                roomParentName: roomMap[roomId].parentId &&
                                    neighborhoodMap[roomMap[roomId].parentId]
                            })),
                            entries: entries.map(({ roomId, ...rest }) => ({
                                ...rest,
                                roomId,
                                roomName: roomMap[roomId].name,
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
