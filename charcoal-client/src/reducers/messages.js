import { RECEIVE_MESSAGE, SET_MESSAGE_OPEN } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage,
    roomDescription,
    announcementMessage,
    neighborhoodDescription,
    directMessage
} from '../store/messages'

const messageSort = ({ CreatedTime: timeA }, { CreatedTime: timeB }) => (timeA - timeB)

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload = '' } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGE:
            const { DisplayProtocol = '', ...rest } = payload
            switch (DisplayProtocol) {
                case 'Player':
                    const { CharacterMessage } = rest
                    if (CharacterMessage && CharacterMessage.Message) {
                        return [ ...state, new playerMessage({ ...rest, ...CharacterMessage }) ].sort(messageSort)
                    }
                    else {
                        return state
                    }
                case 'Announce':
                    const { AnnounceMessage } = rest
                    if (AnnounceMessage && AnnounceMessage.Message) {
                        return [ ...state, new announcementMessage({ ...rest, ...AnnounceMessage }) ].sort(messageSort)
                    }
                    else {
                        return state
                    }
                case 'Direct':
                    const { DirectMessage } = rest
                    if (DirectMessage && DirectMessage.Message) {
                        return [ ...state, new directMessage({ ...rest, ...DirectMessage }) ].sort(messageSort)
                    }
                    else {
                        return state
                    }
                case 'RoomDescription':
                case 'roomDescription':
                    return [ ...state, new roomDescription({ ...rest, ...(rest.RoomDescription || {}) }) ].sort(messageSort)
                case 'neighborhoodDescription':
                    return [ ...state, new neighborhoodDescription(rest) ].sort(messageSort)
                default:
                    const { WorldMessage } = rest
                    if (WorldMessage && WorldMessage.Message) {
                        return [ ...state, new worldMessage({ ...rest, ...WorldMessage }) ].sort(messageSort)
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