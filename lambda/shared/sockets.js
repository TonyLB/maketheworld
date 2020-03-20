const messageConnectionList = async ({ connections = [], gatewayAPI = {}, dbh, postData = {} }) => {
    if (gatewayAPI) {
        const postCalls = connections.map(async (connectionId) => {
            try {
                await gatewayAPI.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
            } catch (e) {
                if (e.statusCode === 410) {
                    console.log(`Found stale connection, deleting ${connectionId}`);
                    await dbh.deleteConnection(connectionId)
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

exports.messageConnectionList = messageConnectionList