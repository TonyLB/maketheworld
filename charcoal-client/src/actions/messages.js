import { API, graphqlOperation } from 'aws-amplify'
import { putRoomMessage, putDirectMessage } from '../graphql/mutations'

import {
    extractMutation,
    populateMutationVariables,
    batchMutations
} from './batchQL'
import { getCharacterId } from '../selectors/connection'

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

export const sendDirectMessage = ({ ToCharacterId, Message }) => (_, getState) => {
    if (ToCharacterId && Message) {
        const state = getState()
        const FromCharacterId = getCharacterId(state)
        const messageTemplate = extractMutation(putDirectMessage)
        const recipients = (ToCharacterId === FromCharacterId) ? [ToCharacterId] : [ToCharacterId, FromCharacterId]
        const messages = recipients.map((CharacterId) => (populateMutationVariables({
            template: messageTemplate,
            CharacterId,
            Message,
            FromCharacterId,
            ToCharacterId,
            MessageId: '',
            CreatedTime: ''
        })))
        return API.graphql(graphqlOperation(batchMutations(messages))).catch((err) => { console.log(err)})
    }
    return Promise.resolve({})

}