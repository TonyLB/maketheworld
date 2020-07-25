// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { getCharactersInPlay, putCharacterInPlay, disconnectCharacterInPlay } = require('./charactersInPlay')
exports.handler = (event) => {

    const { action = 'NO-OP' } = event

    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay()
        case 'putCharacterInPlay':
            return putCharacterInPlay({
                CharacterId: event.CharacterId,
                RoomId: event.RoomId,
                Connected: true
            })
        case 'deleteCharacterInPlay':
            return putCharacterInPlay({
                CharacterId: event.CharacterId,
                Connected: false
            })
        case 'disconnect':
            return disconnectCharacterInPlay({
                CharacterId: event.CharacterId,
                ConnectionId: event.ConnectionId
            })
        default:
            return { statusCode: 500, error: `Unknown handler key: ${action}`}
    }
}