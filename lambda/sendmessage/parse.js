const { TABLE_PREFIX } = process.env;
const connectionTable = `${TABLE_PREFIX}_connections`
const roomTable = `${TABLE_PREFIX}_rooms`

const parseCommand = ({
    name,
    message,
    roomData,
    dbh,
    sockets,
    connectionId
}) => {
    const exits = (roomData && roomData.exits) || []
    const strippedMessage = message.trim()
    const firstMatchedExit = exits.filter(({ exitName }) => (exitName === strippedMessage))
    if (firstMatchedExit.length) {
        const { toRoomId, exitName } = firstMatchedExit[0]
        const connectionPutParams = {
            TableName: connectionTable,
            Item: {
                connectionId: connectionId,
                name,
                roomId: toRoomId
            }
        };
        const roomPutParamsOne = {
            TableName: roomTable,
            Item: {
                ...roomData,
                players: roomData.players.filter((player) => (player.connectionId !== connectionId))
            }
        }
        
        return dbh.getRoom(toRoomId)
            .then((toRoomData) => (toRoomData.Item))
            .then((toRoomData) => ({
                ...toRoomData,
                players: [
                    ...(toRoomData.players || []),
                    {
                        name,
                        connectionId
                    }
                ]
            }))
            .then((toRoomData) => {
                const roomMessages = sockets.messageConnectionList({
                    connections: roomData.players.map(({ connectionId }) => (connectionId)),
                    postData: JSON.stringify({
                        type: 'sendmessage',
                        name: '',
                        protocol: 'worldMessage',
                        message: `${name} has taken the ${exitName} exit.`
                    })
                })
                .then(() => (sockets.messageConnectionList({
                        connections: toRoomData.players.map(({ connectionId }) => (connectionId)),
                        postData: JSON.stringify({
                            type: 'sendmessage',
                            name: '',
                            protocol: 'worldMessage',
                            message: `${name} has arrived.`
                        })
                    })
                ))
                return Promise.all([
                    roomMessages,
                    dbh.put(connectionPutParams),
                    dbh.put(roomPutParamsOne),
                    dbh.put({
                        TableName: roomTable,
                        Item: toRoomData
                    })
                ])
            })
            .then(() => (true))

    }
    else {
        return Promise.resolve(false)
    }
}

exports.parseCommand = parseCommand