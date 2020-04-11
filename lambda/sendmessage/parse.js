const parseCommand = ({
    message,
    playerData,
    roomData,
    world
}) => {
    const name = playerData && playerData.name
    const exits = (roomData && roomData.exits) || []
    const strippedMessage = message.trim()

    const firstMatchedExit = exits.filter(({ name }) => (name === strippedMessage))
    if (firstMatchedExit.length) {
        const { roomId } = roomData
        const { roomId: toRoomId, name: exitName } = firstMatchedExit[0]
        
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