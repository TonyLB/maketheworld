import { FETCH_MY_CHARACTERS_ATTEMPT, FETCH_MY_CHARACTERS_SUCCESS, RECEIVE_MY_CHARACTER_CHANGE } from '../actions/characters.js'

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case FETCH_MY_CHARACTERS_ATTEMPT:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: true,
                    fetched: false
                }
            }
        case FETCH_MY_CHARACTERS_SUCCESS:
            return {
                ...state,
                meta: {
                    ...(state.meta || {}),
                    fetching: false,
                    fetched: true
                },
                data: payload
            }
        case RECEIVE_MY_CHARACTER_CHANGE:
            return {
                ...state,
                data: [
                    ...state.data.filter(({ Name }) => (Name !== payload.Name)),
                    payload
                ].sort(({ Name: nameA }, { Name: nameB }) => (nameA.localeCompare(nameB)))
            }
        default: return state
    }
}

export default reducer