import { RECEIVE_MESSAGE } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage
} from '../store/messages'

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGE:
            const { protocol = '', message = '', ...rest } = payload
            if (message) {
                switch (protocol) {
                    case 'playerMessage':
                        return [ ...state, new playerMessage({ message, ...rest }) ]
                    default:
                        return [ ...state, new worldMessage({ message, ...rest }) ]
                }
            }
            else {
                return state
            }
        default: return state
    }
}

export default reducer