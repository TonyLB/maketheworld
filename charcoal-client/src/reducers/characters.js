import { FETCH_CHARACTERS_ATTEMPT, FETCH_CHARACTERS_SUCCESS } from '../actions/characters.js'

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case FETCH_CHARACTERS_ATTEMPT:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: true,
                    fetched: false
                }
            }
        case FETCH_CHARACTERS_SUCCESS:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: false,
                    fetched: true
                },
                data: payload
            }
        default: return state
    }
}

export default reducer