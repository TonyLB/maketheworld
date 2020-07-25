import { RECEIVE_MESSAGE, SET_MESSAGE_OPEN } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage,
    roomDescription,
    announcementMessage,
    neighborhoodDescription,
    directMessage
} from '../store/messages'

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGE:
            const { DisplayProtocol = '', ...rest } = payload
            const { Message } = rest
            switch (DisplayProtocol) {
                case 'Player':
                    if (Message) {
                        return [ ...state, new playerMessage(rest) ]
                    }
                    else {
                        return state
                    }
                case 'Announce':
                    if (Message) {
                        return [ ...state, new announcementMessage(rest) ]
                    }
                    else {
                        return state
                    }
                case 'Direct':
                    return Message ? [ ...state, new directMessage(rest) ] : state
                case 'roomDescription':
                    return [ ...state, new roomDescription(rest) ]
                case 'neighborhoodDescription':
                    return [ ...state, new neighborhoodDescription(rest) ]
                default:
                    return [ ...state, new worldMessage(rest) ]
            }
        case SET_MESSAGE_OPEN:
            const { MessageId } = payload
            return state.map((message) => ((message.MessageId === MessageId) ? message.update({ open: payload.open }) : message))
        default: return state
    }
}

export default reducer