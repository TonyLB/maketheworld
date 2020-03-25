import {
    roomDescription
} from '../store/messages'

export const getMessages = ({ messages }) => messages

export const getMostRecentRoomMessage = ({ messages }) => {
    const roomMessages = messages.filter((message) => (message instanceof roomDescription))
    if (roomMessages.length) {
        return roomMessages[roomMessages.length-1]
    }
    else {
        return {}
    }

}
