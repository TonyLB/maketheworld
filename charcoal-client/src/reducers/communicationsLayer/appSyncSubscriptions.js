import { SUBSCRIPTION_ATTEMPT, SUBSCRIPTION_SUCCESS, SUBSCRIPTION_ERROR } from '../../actions/communicationsLayer/appSyncSubscriptions.js'

const initialState = (rootLevelKeys) => ({
    ...Object.assign({}, ...rootLevelKeys.map(key => ({ [key]: { status: 'INITIAL' } }))),
    characters: {}
})

export const reducer = (state = initialState(['permanents', 'ephemera', 'player']), action = {}) => {
    const { type: actionType = "NOOP", payload = {} } = action
    switch (actionType) {
        case SUBSCRIPTION_ATTEMPT:
            if (payload.key) {
                if (payload.key === 'characters') {
                    if (payload.characterId) {
                        return {
                            ...state,
                            characters: {
                                ...state.characters,
                                [payload.characterId]: {
                                    ...(state.characters[payload.characterId] ?? {}),
                                    status: 'CONNECTING'
                                }
                            }
                        }
                    }
                    else {
                        return state
                    }
                }
                else {
                    return {
                        ...state,
                        [payload.key]: {
                            ...(state[payload.key] ?? {}),
                            status: 'CONNECTING'
                        }
                    }
                }
            }
        case SUBSCRIPTION_SUCCESS:
            return Object.entries(payload).reduce((previous, [key, value]) => {
                if (key === 'characters') {
                    return {
                        ...previous,
                        characters: Object.entries(value)
                            .reduce((previousCharacters, [characterId, subscription]) => ({
                                ...previousCharacters,
                                [characterId]: {
                                    ...(previousCharacters[characterId] ?? {}),
                                    status: 'CONNECTED',
                                    subscription
                                }
                            }), previous.characters ?? {})
                    }
                }
                else {
                    return {
                        ...previous,
                        [key]: {
                            ...(state[key] ?? {}),
                            status: 'CONNECTED',
                            subscription: value
                        }
                    }
                }
            }, state)
        case SUBSCRIPTION_ERROR:
            if (payload.key) {
                if (payload.key === 'characters') {
                    if (payload.characterId) {
                        return {
                            ...state,
                            characters: {
                                ...state.characters,
                                [payload.characterId]: {
                                    ...(state.characters[payload.characterId] ?? {}),
                                    status: 'ERROR'
                                }
                            }
                        }
                    }
                    else {
                        return state
                    }
                }
                else {
                    return {
                        ...state,
                        [payload.key]: {
                            ...(state[payload.key] ?? {}),
                            status: 'ERROR'
                        }
                    }
                }
            }        default: return state
    }
}

export default reducer