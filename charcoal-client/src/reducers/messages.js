import { RECEIVE_MESSAGES, SET_MESSAGE_OPEN } from '../actions/messages.js'
import {
    playerMessage,
    worldMessage,
    roomDescription,
    announcementMessage,
    neighborhoodDescription,
    directMessage
} from '../store/messages'

const messageSort = ({ CreatedTime: timeA }, { CreatedTime: timeB }) => (timeA - timeB)

//
// messageByProtocol looks at the DisplayProtocol passed, and creates an object of the appropriate Message subclass.
//
const messageByProtocol = (displayProtocol) => (rest) => {
    switch (displayProtocol) {
        case 'Player':
            const { CharacterMessage } = rest
            return (CharacterMessage && CharacterMessage.Message) ? (new playerMessage({ ...rest, ...CharacterMessage })) : null
        case 'Announce':
            const { AnnounceMessage } = rest
            return (AnnounceMessage && AnnounceMessage.Message) ? (new announcementMessage({ ...rest, ...AnnounceMessage })) : null
        case 'Direct':
            const { DirectMessage } = rest
            return (DirectMessage && DirectMessage.Message) ? ( new directMessage({ ...rest, ...DirectMessage })) : null
        case 'RoomDescription':
        case 'roomDescription':
            return new roomDescription({ ...rest, ...(rest.RoomDescription || {}) })
        case 'neighborhoodDescription':
            return new neighborhoodDescription(rest)
        default:
            const { WorldMessage } = rest
            return (WorldMessage && WorldMessage.Message) ? (new worldMessage({ ...rest, ...WorldMessage })) : null
    }
}

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGES:
            return (payload || []).reduce((previous, { DisplayProtocol = '', ...rest }) => {
                const revisedPrevious = previous.filter(({ MessageId, Target }) => (MessageId !== rest.MessageId || Target !== rest.Target))
                const newMessage = messageByProtocol(DisplayProtocol)(rest)
                if (newMessage) {
                    return [ ...revisedPrevious, newMessage ]
                }
                else {
                    return previous
                }
            }, state).sort(messageSort)
        case SET_MESSAGE_OPEN:
            const { MessageId, open } = (payload || {})
            return state.map((message) => ((message.MessageId === MessageId) ? message.update({ open }) : message))
        default: return state
    }
}

export default reducer