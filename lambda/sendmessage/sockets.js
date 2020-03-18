const { TABLE_PREFIX } = process.env;

const connectionTable = `${TABLE_PREFIX}_connections`

const messageConnectionList = async ({ connections = [], gatewayAPI = {}, ddb, postData = {} }) => {
    if (gatewayAPI) {
        const postCalls = connections.map(async (connectionId) => {
            try {
                await gatewayAPI.postToConnection({ ConnectionId: connectionId, Data: postData }).promise();
            } catch (e) {
                if (e.statusCode === 410) {
                    console.log(`Found stale connection, deleting ${connectionId}`);
                    await ddb.delete({ TableName: connectionTable, Key: { connectionId } }).promise();
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