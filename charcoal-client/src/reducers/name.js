import { SET_NAME } from '../actions/name.js'

export const reducer = (state = '', action = {}) => {
    const { type: actionType = "NOOP", payload = '' } = action
    switch (actionType) {
        case SET_NAME:
            return payload || state
        default: return state
    }
}

export default reducer