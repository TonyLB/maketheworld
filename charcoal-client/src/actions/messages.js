import { API, graphqlOperation } from 'aws-amplify'
import { putRoomMessage } from '../graphql/mutations'


export const RECEIVE_MESSAGE = 'RECEIVE_MESSAGE'

export const receiveMessage = (message) => ({
    type: RECEIVE_MESSAGE,
    payload: message
})

export const worldMessageAdded = (message) => (receiveMessage({
    protocol: 'worldMessage',
    message
}))

export const playerMessageAdded = ({ CharacterId, Message }) => (receiveMessage({
    protocol: 'playerMessage',
    CharacterId,
    Message
}))

export const directMessageAdded = ({ ToCharacterId, FromCharacterId, Message }) => (receiveMessage({
    protocol: 'directMessage',
    ToCharacterId,
    FromCharacterId,
    Message
}))

export const announcementAdded = ({ Message, Title }) => (receiveMessage({
    protocol: 'announcementMessage',
    Message,
    Title
}))

export const sendMessage = ({RoomId, Message, FromCharacterId}) => {
    if (RoomId && Message) {
        return API.graphql(graphqlOperation(putRoomMessage, {
            RoomId,
            Message,
            FromCharacterId
        }))
        .catch((err) => { console.log(err)})
    }
    return Promise.resolve({})
}
