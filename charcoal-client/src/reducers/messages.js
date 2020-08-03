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
            switch (DisplayProtocol) {
                case 'Player':
                    const { CharacterMessage } = rest
                    if (CharacterMessage && CharacterMessage.Message) {
                        return [ ...state, new playerMessage({ ...rest, ...CharacterMessage }) ]
                    }
                    else {
                        return state
                    }
                case 'Announce':
                    const { AnnounceMessage } = rest
                    if (AnnounceMessage && AnnounceMessage.Message) {
                        return [ ...state, new announcementMessage({ ...rest, ...AnnounceMessage }) ]
                    }
                    else {
                        return state
                    }
                case 'Direct':
                    const { DirectMessage } = rest
                    if (DirectMessage && DirectMessage.Message) {
                        return [ ...state, new directMessage({ ...rest, ...DirectMessage }) ]
                    }
                    else {
                        return state
                    }
                case 'roomDescription':
                    return [ ...state, new roomDescription(rest) ]
                case 'neighborhoodDescription':
                    return [ ...state, new neighborhoodDescription(rest) ]
                default:
                    const { WorldMessage } = rest
                    if (WorldMessage && WorldMessage.Message) {
                        return [ ...state, new worldMessage({ ...rest, ...WorldMessage }) ]
                    }
                    else {
                        return state
                    }
            }
        case SET_MESSAGE_OPEN:
            const { MessageId } = payload
            return state.map((message) => ((message.MessageId === MessageId) ? message.update({ open: payload.open }) : message))
        default: return state
    }
}

export default reducer