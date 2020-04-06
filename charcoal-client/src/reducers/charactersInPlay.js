import {
    FETCH_CHARACTERS_IN_PLAY_ATTEMPT,
    FETCH_CHARACTERS_IN_PLAY_SUCCESS,
    RECEIVE_CHARACTERS_IN_PLAY_CHANGE
} from '../actions/characters.js'

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
            const mappedPayload = payload
                .reduce((previous, {
                    CharacterId,
                    Character,
                    RoomId,
                    ConnectionId
                }) => ({
                    ...previous,
                    [CharacterId]: {
                        CharacterId,
                        RoomId,
                        ConnectionId,
                        ...Character
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
                return {
                    ...state,
                    [CharacterId]: {
                        CharacterId,
                        ...Character,
                        ...rest
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