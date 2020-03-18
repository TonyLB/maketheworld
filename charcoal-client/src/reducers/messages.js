import { RECEIVE_MESSAGE } from '../actions/messages.js'

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGE:
            const { name = '', message = '' } = payload
            if (message) {
                return [ ...state, { name, message } ]
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer