import { FETCH_CURRENT_ROOM_ATTEMPT, FETCH_CURRENT_ROOM_SUCCESS } from '../actions/currentRoom.js'

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case FETCH_CURRENT_ROOM_ATTEMPT:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: true,
                    fetched: false
                }
            }
        case FETCH_CURRENT_ROOM_SUCCESS:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: false,
                    fetched: true
                },
                ...payload
            }
        default: return state
    }
}

export default reducer