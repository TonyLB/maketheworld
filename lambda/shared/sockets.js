const AWS = require('aws-sdk')

class socketHandler {
    constructor({ dbh, event }) {
        this.gwAPI = new AWS.ApiGatewayManagementApi({
            apiVersion: '2018-11-29',
            endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
        })
        this.dbh = dbh
    }

    messageConnectionList = async ({ connections = [], postData = {} }) => {
        if (this.gwAPI) {
            const postCalls = connections.map(async (connectionId) => {
                try {
                    await this.gwAPI.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
                } catch (e) {
                    if (e.statusCode === 410) {
                        console.log(`Found stale connection, deleting ${connectionId}`);
                        await this.dbh.deleteConnection(connectionId)
                    } else {
                        throw e;
                    }
                }
            })

            return Promise.all(postCalls);
        }
        else {
            return Promise.resolve()
        }
    }
}

exports.socketHandler = socketHandler