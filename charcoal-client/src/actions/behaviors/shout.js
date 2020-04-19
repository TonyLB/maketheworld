import { API, graphqlOperation } from 'aws-amplify'
import { putRoomMessage } from '../../graphql/mutations'

import {
    extractMutation,
    populateMutationVariables,
    batchMutations
} from '../batchQL'

import { getMyCurrentCharacter } from '../../selectors/myCharacters'
import { getCurrentRoom } from '../../selectors/currentRoom'

import { activateConfirmDialog } from '../UI/confirmDialog'

export const broadcastMessage = ({ message = '', roomIds = [] }) => (dispatch) => {
    const messageTemplate = extractMutation(putRoomMessage)
    const messages = roomIds.map((permanentId) => (populateMutationVariables({
        template: messageTemplate,
        RoomId: permanentId,
        Message: message,
        Title: '',
        MessageType: '',
        FromCharacterId: '',
        MessageId: '',
        CreatedTime: ''
    })))
    return API.graphql(graphqlOperation(batchMutations(messages))).catch((err) => { console.log(err)})
}

export const shout = (message = 'Arrgh!') => (dispatch, getState) => {
    const state = getState()
    const currentCharacter = getMyCurrentCharacter()(state)
    const currentRoom = getCurrentRoom(state)
    const shoutMessage = `From ${(currentRoom && currentRoom.Name) || 'Unknown'}, ${(currentCharacter && currentCharacter.Name) || 'Someone'} shouts: ${message}`
    if (currentCharacter) {
        const roomIds = currentRoom
            && currentRoom.Exits
            && [
                currentRoom.PermanentId,
                ...(currentRoom.Exits.filter(({ RoomId }) => (RoomId))
                    .map(({ RoomId }) => RoomId))
            ]
        dispatch(activateConfirmDialog({
            title: 'Shout',
            message: shoutMessage,
            content: `Are you sure you want to shout?  It will be heard in ${roomIds.length} rooms.`,
            resolveButtonTitle: 'Shout!',
            resolve: () => {
                dispatch(broadcastMessage({ message: shoutMessage, roomIds }))
            }
        }))
    }    
}

export default shout