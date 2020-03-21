const parseCommand = ({
    message,
    playerData,
    roomData,
    world
}) => {
    const name = playerData && playerData.name
    const connectionId = playerData && playerData.connectionId
    const dbh = world.dbh
    const sockets = world.sockets
    const exits = (roomData && roomData.exits) || []
    const strippedMessage = message.trim()
    const firstMatchedExit = exits.filter(({ exitName }) => (exitName === strippedMessage))
    if (firstMatchedExit.length) {
        const { toRoomId, exitName } = firstMatchedExit[0]
        
        return dbh.getRoom(toRoomId)
            .then((toRoomData) => {
                const exitMessage = sockets.messageConnectionList({
                    connections: roomData.players.map(({ connectionId }) => (connectionId)),
                    postData: JSON.stringify({
                        type: 'sendmessage',
                        name: '',
                        protocol: 'worldMessage',
                        message: `${name} has taken the ${exitName} exit.`
                    })
                })
                return exitMessage
                    .then(() => (world.removePlayerFromRoom({ roomData, connectionId })))
                    .then(() => (world.movePlayerToRoom({
                        roomData: toRoomData,
                        playerData
                    })))
                    .then(() => (sockets.messageConnectionList({
                            connections: [
                                ...(toRoomData.players.map(({ connectionId }) => (connectionId))),
                                playerData.connectionId
                            ],
                            postData: JSON.stringify({
                                type: 'sendmessage',
                                name: '',
                                protocol: 'worldMessage',
                                message: `${name} has arrived.`
                            })
                        })
                    ))
            })
            .then(() => (true))
    }
    else {
        return Promise.resolve(false)
    }
}

exports.parseCommand = parseCommand