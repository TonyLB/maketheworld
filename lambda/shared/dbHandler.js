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
    // getRoom:  Gets the entry from the rooms table for a given ID.
    //
    // TODO:  Create a room class, instantiate that class on fetch, and serialize back out
    // on put.
    //
    getRoom(roomId) {
        return this.documentClient.get({ TableName: this.permanentTable, Key: { permanentId: roomId } })
            .promise()
            .then(({ Item: { type, permanentId, ...Item } }) => {
                return this.documentClient.query({
                        TableName: this.permanentTable,
                        IndexName: 'fromRoomIndex',
                        KeyConditionExpression: 'fromRoomId = :roomId',
                        ExpressionAttributeValues: { ':roomId': roomId }
                    }).promise()
                    .then(({ Items }) => (Items.map(({ name, parentId }) => ({ exitName: name, toRoomId: parentId }))))
                    .then((exits) => {

                        return this.documentClient.scan({
                            TableName: this.connectionTable,
                            FilterExpression: 'roomId = :roomId',
                            ExpressionAttributeValues: { ':roomId': roomId }
                        }).promise()
                        .then(({ Items }) => ({
                            ...Item,
                            roomId,
                            players: Items,
                            exits
                        }))
                    })
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
