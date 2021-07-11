// Copyright 2020 Tony Lower-Basch. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

const { getCharactersInPlay, putCharacterInPlay } = require('./charactersInPlay')
const { denormalizeCharacter, denormalizeRoom } = require('./denormalize')
const { queueClear, queueState, queueFlush } = require('./feedbackQueue')

const splitPermanentId = (PermanentId) => {
    const sections = PermanentId.split('#')
    if (!(sections.length > 1)) {
        return [PermanentId]
    }
    else {
        return [sections[0], sections.slice(1).join('#')]
    }
}

const updateDispatcher = ({ Updates = [] }) => {
    const outputs = Updates.map((update) => {
        if (update.putCharacterInPlay) {
                return putCharacterInPlay(update.putCharacterInPlay)
            }
        return Promise.resolve([])
    })

    return Promise.all(outputs)
}

const denormalizeDispatcher = ({ PermanentId, data }) => {
    const [type, payload] = splitPermanentId(PermanentId)
    switch(type) {
        case 'CHARACTER':
            return denormalizeCharacter({ CharacterId: payload, data })
        case 'ROOM':
            return denormalizeRoom({ RoomId: payload, data })
        default:
            return Promise({})
    }
}

exports.handler = async (event, context) => {

    const { action = 'NO-OP', directCall = false, ...payload } = event

    queueClear()
    switch(action) {
        case 'getCharactersInPlay':
            return getCharactersInPlay()
        
        case 'updateEphemera':
            await updateDispatcher(payload)
            const updates = queueState()
            if (directCall) {
                await queueFlush()
            }
            return updates

        case 'denormalize':
            const denormalize = await denormalizeDispatcher(payload)
            if (queueState()) {
                await queueFlush()
            }
            return denormalize

        default:
            context.fail(JSON.stringify(`Error: Unknown action: ${action}`))
    }
}