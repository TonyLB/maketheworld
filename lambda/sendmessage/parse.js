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

    if (strippedMessage === 'l' || strippedMessage === 'look') {
        return sockets.messageToSelf(JSON.stringify({
            type: 'sendmessage',
            protocol: 'roomDescription',
            ...roomData
        }))
        .then(() => (true))
    }
    const firstMatchedExit = exits.filter(({ exitName }) => (exitName === strippedMessage))
    if (firstMatchedExit.length) {
        const { roomId } = roomData
        const { toRoomId, exitName } = firstMatchedExit[0]
        
        return world.messageRoom({
                roomId,
                postData: JSON.stringify({
                    type: 'sendmessage',
                    name: '',
                    protocol: 'worldMessage',
                    message: `${name} has taken the ${exitName} exit.`
                })
            })
            .then(() => (world.movePlayerToRoom({
                roomId: toRoomId,
                playerData
            })))
            .then(() => (world.messageRoom({
                roomId: toRoomId,
                postData: JSON.stringify({
                    type: 'sendmessage',
                    name: '',
                    protocol: 'worldMessage',
                    message: `${name} has arrived.`
                })
            })))
            .then(() => (true))
    }
    else {
        return Promise.resolve(false)
    }
}

exports.parseCommand = parseCommand