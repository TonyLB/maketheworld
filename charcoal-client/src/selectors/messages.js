import {
    roomDescription,
    neighborhoodDescription
} from '../store/messages'
import { getClientSettings } from './clientSettings'

export const getMessages = (state) => {
    const { messages } = state
    const { ShowNeighborhoodHeaders } = getClientSettings(state)

    return ShowNeighborhoodHeaders
        ? messages
        : messages.filter((message) => (!(message instanceof neighborhoodDescription)))
}

export const getMostRecentRoomMessage = ({ messages }) => {
    const roomMessages = messages.filter((message) => (message instanceof roomDescription))
    if (roomMessages.length) {
        return roomMessages[roomMessages.length-1]
    }
    else {
        return {}
    }

}
