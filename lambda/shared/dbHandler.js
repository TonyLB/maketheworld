const AWS = require('aws-sdk');

class dbHandler {
    constructor(processEnv) {
        const { TABLE_PREFIX, AWS_REGION } = processEnv;
        this.roomTable = `${TABLE_PREFIX}_rooms`
        this.connectionTable = `${TABLE_PREFIX}_connections`

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
        return this.documentClient.get({ TableName: this.roomTable, Key: { roomId } }).promise()
    }

    //
    // getConnection:  Gets the entry from the connectionss table for a given ID.
    //
    // TODO:  Create a connection class, instantiate that class on fetch, and serialize back out
    // on put.
    //
    getConnection(connectionId) {
        return this.documentClient.get({ TableName: this.connectionTable, Key: { connectionId } }).promise()
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

    //
    // flush:  Puts the items in the writeQueue to the database.
    //
    flush() {
        // TODO
    }
}

exports.dbHandler = dbHandler
