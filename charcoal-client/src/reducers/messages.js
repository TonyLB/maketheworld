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

export const reducer = (state = [], action) => {
    const { type: actionType = 'NOOP', payload } = action || {}
    switch (actionType) {
        case RECEIVE_MESSAGES:
            return (payload || []).reduce((previous, { DisplayProtocol = '', ...rest }) => {
                const revisedPrevious = previous.filter(({ MessageId }) => (MessageId != rest.MessageId))
                switch (DisplayProtocol) {
                    case 'Player':
                        const { CharacterMessage } = rest
                        if (CharacterMessage && CharacterMessage.Message) {
                            return [ ...revisedPrevious, new playerMessage({ ...rest, ...CharacterMessage }) ]
                        }
                        else {
                            return previous
                        }
                    case 'Announce':
                        const { AnnounceMessage } = rest
                        if (AnnounceMessage && AnnounceMessage.Message) {
                            return [ ...revisedPrevious, new announcementMessage({ ...rest, ...AnnounceMessage }) ]
                        }
                        else {
                            return previous
                        }
                    case 'Direct':
                        const { DirectMessage } = rest
                        if (DirectMessage && DirectMessage.Message) {
                            return [ ...revisedPrevious, new directMessage({ ...rest, ...DirectMessage }) ]
                        }
                        else {
                            return previous
                        }
                    case 'RoomDescription':
                    case 'roomDescription':
                        return [ ...revisedPrevious, new roomDescription({ ...rest, ...(rest.RoomDescription || {}) }) ]
                    case 'neighborhoodDescription':
                        return [ ...revisedPrevious, new neighborhoodDescription(rest) ]
                    default:
                        const { WorldMessage } = rest
                        if (WorldMessage && WorldMessage.Message) {
                            return [ ...revisedPrevious, new worldMessage({ ...rest, ...WorldMessage }) ]
                        }
                        else {
                            return previous
                        }
                }
            }, state).sort(messageSort)
        case SET_MESSAGE_OPEN:
            const { MessageId, open } = (payload || {})
            return state.map((message) => ((message.MessageId === MessageId) ? message.update({ open }) : message))
        default: return state
    }
}

export default reducer