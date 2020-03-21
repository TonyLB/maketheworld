const AWS = require('aws-sdk')

class socketHandler {
    constructor({ dbh, event }) {
        this.gwAPI = new AWS.ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
        })
        this.dbh = dbh
        this.connectionId = event.requestContext.connectionId
        this.playerData = {}
    }

    getPlayerData = () => {
        if (this.playerData) {
            return Promise.resolve(this.playerData)
        }
        else {
            return this.dbh.getConnection(this.connectionId)
                .then((playerData) => {
                    this.playerData = playerData
                    return playerData
                })
        }
    }

    messageConnectionList = ({ connections = [], postData = {} }) => {
        if (this.gwAPI) {
            const postCalls = connections.map((connectionId) => (
                this.gwAPI.postToConnection({ ConnectionId: connectionId, Data: postData })
                    .promise()
                    .catch((e) => {
                        if (e.statusCode === 410) {
                            console.log(`Found stale connection, deleting ${connectionId}`);
                            return this.dbh.deleteConnection(connectionId)
                        } else {
                            throw e;
                        }
                    })
                ))
            return Promise.all(postCalls);
        }
        else {
            return Promise.resolve()
        }
    }

    messageToSelf = (postData) => (
        this.messageConnectionList({
            connections: [ this.connectionId ],
            postData
        })
    )

    debugMessage = (message) => (
        this.messageToSelf(JSON.stringify({
                type: 'debug',
                message
        }))
        .then(() => (message))
    )
}

exports.socketHandler = socketHandler