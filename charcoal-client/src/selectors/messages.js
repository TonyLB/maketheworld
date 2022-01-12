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

//
// TODO: Rework this selector with @reduxjs/Toolkit in order to get the memoizing benefit of reselect
//
export const getActiveCharacterInPlayMessages = (CharacterId) => (state) => {
    const messages = getMessages(state)
    return messages
        .filter(({ Target, ThreadId }) => (Target === CharacterId && ThreadId === undefined))
}