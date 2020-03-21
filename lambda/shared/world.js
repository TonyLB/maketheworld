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

    removePlayerFromRoom({
        connectionId,
        roomId,
        roomData
    }) {
        return (
            this.fetchRoomData({
                roomId,
                roomData
            }).then((roomData) => {
                const updatedRoomData = {
                    ...roomData,
                    players: roomData.players.filter((player) => (player.connectionId !== connectionId))
                }
                return this.dbh.putRoom(updatedRoomData)
                    .then(() => (updatedRoomData))
            })
        )
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
                    players: [ ...roomData.players, playerData]
                }
                const updateRoom = this.dbh.putRoom(updatedRoomData)
                const roomDescData = JSON.stringify({
                        type: 'sendmessage',
                        protocol: 'roomDescription',
                        ...roomData
                    })
                const updateConnection = this.dbh.putConnection({
                    ...playerData,
                    roomId: roomData.roomId
                })
                const roomDescMessage = this.sockets.messageToSelf(roomDescData)
                return Promise.all([
                    updateRoom,
                    updateConnection,
                    roomDescMessage
                ])
            })
        )
    }

    messageRoom ({
        roomId,
        roomData,
        postData
    }) {

        return (
            this.fetchRoomData({
                roomId,
                roomData
            })
            .then((roomData) => (
                this.sockets.messageConnectionList({
                    connections: roomData.players.map(({ connectionId }) => (connectionId)),
                    postData
                })
            ))
        )
    }

    messageRoomExceptMe ({
        roomId,
        roomData,
        postData
    }) {

        return (
            this.fetchRoomData({
                roomId,
                roomData
            })
            .then((roomData) => (
                this.sockets.messageConnectionList({
                    connections: roomData.players
                        .map(({ connectionId }) => (connectionId))
                        .filter((player) => (player !== this.sockets.connectionId)),
                    postData
                })
            ))
        )
    }

}

exports.worldHandler = worldHandler