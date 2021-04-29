// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { graphqlClient, gql } = require('./utilities')

const { getCharactersInPlay, putCharacterInPlay } = require('./charactersInPlay')

const broadcastGQL = (Updates) => (gql`mutation BroadcastGQL {
    broadcastEphemera (Ephemera: [
            ${Updates.map(({ CharacterInPlay: { CharacterId, RoomId, Connected } = {} }) => 
                (`{ CharacterInPlay: { CharacterId: "${CharacterId}", RoomId: "${RoomId}", Connected: ${Connected ? 'true' : 'false'} } }`))
                .join('\n            ')}
        ]) {
        CharacterInPlay {
            CharacterId
            RoomId
            Connected
        }
    }
}`)

const updateDispatcher = ({ Updates = [] }) => {
    const outputs = Updates.map((update) => {
        if (update.putCharacterInPlay) {
                return putCharacterInPlay(update.putCharacterInPlay)
            }
            return Promise.resolve([])
        }
    )

    return Promise.all(outputs)
        .then((finalOutputs) => finalOutputs.reduce((previous, output) => ([ ...previous, ...output ]), []))
}

exports.handler = async (event, context) => {

    const { action = 'NO-OP', directCall = false, ...payload } = event

    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay()
        
        case 'updateEphemera':
            const updates = await updateDispatcher(payload)
            if (directCall) {
                await graphqlClient.mutate({ mutation: broadcastGQL(updates) })
            }
            return updates

        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}