import { RECEIVE_MESSAGES, SET_MESSAGE_OPEN } from '../actions/messages.js'
import { RECEIVE_JSON_MESSAGES } from '../slices/lifeLine'
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

const messageFromJson = ({ DisplayProtocol, ...props }) => {
    switch (DisplayProtocol) {
        case 'Player':
            return (props?.Message) ? (new playerMessage(props)) : null
        case 'Announce':
            return (props?.Message) ? (new announcementMessage(props)) : null
        case 'Direct':
            return (props?.Message) ? (new directMessage(props)) : null
        case 'RoomDescription':
        case 'roomDescription':
            return new roomDescription(props)
        case 'neighborhoodDescription':
            return new neighborhoodDescription(props)
        default:
            return (props?.Message) ? (new worldMessage(props)) : null
    }   
}

//
// TODO:  Refactor the message store to use a Typescript union rather than class dispatching.
//
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
        case RECEIVE_JSON_MESSAGES:
            return (payload || []).reduce((previous, { DisplayProtocol = '', ...rest }) => {
                const revisedPrevious = previous.filter(({ MessageId, Target }) => (MessageId !== rest.MessageId || Target !== rest.Target))
                const newMessage = messageFromJson({ DisplayProtocol, ...rest })
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