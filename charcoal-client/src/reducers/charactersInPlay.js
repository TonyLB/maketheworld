import {
    FETCH_CHARACTERS_IN_PLAY_ATTEMPT,
    FETCH_CHARACTERS_IN_PLAY_SUCCESS,
    RECEIVE_CHARACTERS_IN_PLAY_CHANGE
} from '../actions/characters.js'

const colorSequence = ['pink', 'purple', 'green']
    .map(color => ({
        primary: color,
        light: `light${color}`,
        recap: `recap${color}`,
        recapLight: `recapLight${color}`,
        direct: `direct${color}`
    }))

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case FETCH_CHARACTERS_IN_PLAY_ATTEMPT:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: true,
                    fetched: false
                }
            }
        case FETCH_CHARACTERS_IN_PLAY_SUCCESS:
            const alreadyColorMappedPayload = payload
                .map(({ CharacterId, ...rest }) => ({
                    CharacterId,
                    ...rest,
                    color: (state && state[CharacterId] && state[CharacterId].color)
                }))
            const colorStartingIndex = alreadyColorMappedPayload.filter(({ color }) => color).length % 3
            const finalColorMappedPayload = [
                ...alreadyColorMappedPayload.filter(({ color }) => (color)),
                ...alreadyColorMappedPayload.filter(({ color }) => (!color))
                    .map((item, index) => ({ ...item, color: colorSequence[(index + colorStartingIndex) % 3]}))
            ]
            const mappedPayload = finalColorMappedPayload
                .reduce((previous, {
                    CharacterId,
                    Character,
                    RoomId,
                    Connected,
                    color
                }) => ({
                    ...previous,
                    [CharacterId]: {
                        CharacterId,
                        RoomId,
                        Connected,
                        ...Character,
                        color
                    }
                }), {})
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: false,
                    fetched: true
                },
                ...mappedPayload
            }
        case RECEIVE_CHARACTERS_IN_PLAY_CHANGE:
            const { CharacterId, Character, ...rest } = action.payload || {}
            if (CharacterId) {
                const nextColorIndex = (Object.values(state).length + 2) % 3
                return {
                    ...state,
                    [CharacterId]: {
                        CharacterId,
                        ...Character,
                        ...rest,
                        color: (state && state[CharacterId] && state[CharacterId].color) || colorSequence[nextColorIndex]
                    }
                }
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer