import { RECEIVE_MESSAGE } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage,
    roomDescription
} from '../store/messages'

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGE:
            const { protocol = '', ...rest } = payload
            switch (protocol) {
                case 'playerMessage':
                    const { Message } = rest
                    if (Message) {
                        return [ ...state, new playerMessage(rest) ]
                    }
                    else {
                        return state
                    }
                case 'roomDescription':
                    return [ ...state, new roomDescription(rest) ]
                default:
                    return [ ...state, new worldMessage(rest) ]
            }
        default: return state
    }
}

export default reducer