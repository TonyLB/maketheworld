// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { getCharactersInPlay, putCharacterInPlay, disconnectCharacterInPlay } = require('./charactersInPlay')


const updateDispatcher = ({ Updates = [] }) => {
    const outputs = Updates.map((update) => {
            if (update.putCharacterInPlay) {
                return putCharacterInPlay(update.putCharacterInPlay)
            }
            if (update.disconnectCharacterInPlay) {
                return disconnectCharacterInPlay(update.disconnectCharacterInPlay)
            }
            return Promise.resolve([])
        }
    )

    return Promise.all(outputs)
        .then((finalOutputs) => finalOutputs.reduce((previous, output) => ([ ...previous, ...output ]), []))
}

exports.handler = (event, context) => {

    const { action = 'NO-OP', ...payload } = event

    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay()
        
        case 'updateEphemera':
            return updateDispatcher(payload)

        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}