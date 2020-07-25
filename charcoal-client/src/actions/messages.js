import { API, graphqlOperation } from 'aws-amplify'
import { updateMessages, putDirectMessage } from '../graphql/mutations'
import { v4 as uuidv4 } from 'uuid'

import {
    extractMutation,
    populateMutationVariables,
    batchMutations
} from './batchQL'
import { getCharacterId } from '../selectors/connection'
import { getActiveCharactersInRoom } from '../selectors/charactersInPlay'

export const RECEIVE_MESSAGE = 'RECEIVE_MESSAGE'
export const SET_MESSAGE_OPEN = 'SET_MESSAGE_OPEN'

export const receiveMessage = ({ MessageId, ...message }) => ({
    type: RECEIVE_MESSAGE,
    payload: {
        MessageId: MessageId || uuidv4(),
        ...message
    }
})

export const setMessageOpen = ({ MessageId, open }) => ({
    type: SET_MESSAGE_OPEN,
    payload: {
        MessageId,
        open
    }
})

export const sendMessage = ({RoomId = null, Message, CharacterId, Characters = [], DisplayProtocol = '', Recipients}) => (dispatch, getState) => {
    const state = getState()
    const roomCharacters = (RoomId && getActiveCharactersInRoom({ RoomId })(state).map(({ CharacterId }) => (CharacterId))) || []
    if (Message) {
        return API.graphql(graphqlOperation(updateMessages, { Updates: [{ putMessage: {
            RoomId,
            Message,
            Characters: [ ...Characters, ...roomCharacters ],
            MessageId: uuidv4(),
            CharacterId,
            DisplayProtocol: DisplayProtocol || (CharacterId ? "Player" : "World"),
            Recipients
        }}]}))
        .catch((err) => { console.log(err)})
    }
    return Promise.resolve({})
}
