class worldHandler {
    constructor(sockets) {
        this.sockets = sockets
        this.dbh = sockets.dbh
    }

    fetchRoomData ({
        roomId,
        roomData
    }) {
        return roomData
            ? Promise.resolve(roomData)
            : this.dbh.getRoom(roomId)
    }

    fetchAllData ({
        connectionId,
        playerData,
        roomId,
        roomData
    }) {
        const getPlayerData = playerData ? Promise.resolve(playerData) : this.dbh.getConnection(connectionId)
        return getPlayerData.then((playerData) => {
            const getRoomData = roomData
                ? Promise.resolve(roomData)
                : roomId
                    ? this.dbh.getRoom(roomId)
                    : this.dbh.getRoom(playerData.roomId)
            return getRoomData.then((roomData) => ({ roomData, playerData }))
        })
    }

    movePlayerToRoom({
        connectionId,
        playerData,
        roomId,
        roomData
    }) {
        return (
            this.fetchAllData({
                connectionId,
                playerData,
                roomId,
                roomData
            }).then(({ roomData, playerData }) => {
                const updatedRoomData = {
                    ...roomData,
                    players: [
                        ...(roomData.players
                            .filter(({ connectionId }) => ( connectionId !== playerData.connectionId ))),
                        playerData
                    ]
                }
                const roomDescData = JSON.stringify({
                        type: 'sendmessage',
                        protocol: 'roomDescription',
                        ...updatedRoomData
                    })
                const roomDescMessage = this.sockets.messageToSelf(roomDescData)

                const updateConnection = this.dbh.putConnection({
                    ...playerData,
                    roomId: roomData.roomId
                })
                return Promise.all([
                    updateConnection,
                    roomDescMessage
                ])
            })
        )
    }

    messageRoom ({
        roomId,
        postData
    }) {

        return (
            this.dbh.getRoomConnections(roomId)
                .then((connections) => (
                    this.sockets.messageConnectionList({
                        connections,
                        postData
                    })
                ))
        )
    }

    messageRoomExceptMe ({
        roomId,
        postData
    }) {

        return (
            this.dbh.getRoomConnections(roomId)
                .then((connections) => connections.filter((connectionId) => (connectionId !== this.sockets.connectionId)))
                .then((connections) => (
                    this.sockets.messageConnectionList({
                        connections,
                        postData
                    })
                ))
        )
    }

}

exports.worldHandler = worldHandler