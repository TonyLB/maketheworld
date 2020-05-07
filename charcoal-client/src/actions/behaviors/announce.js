import { API, graphqlOperation } from 'aws-amplify'
import { putRoomMessage } from '../../graphql/mutations'

import {
    extractMutation,
    populateMutationVariables,
    batchMutations
} from '../batchQL'

import { getMyCurrentCharacter } from '../../selectors/myCharacters'
import { getCurrentNeighborhood } from '../../selectors/currentRoom'
import { getRoomIdsInNeighborhood } from '../../selectors/permanentHeaders'

import { activateConfirmDialog } from '../UI/confirmDialog'

export const broadcastMessage = ({ title = 'Announcement', message = '', roomIds = [] }) => (dispatch) => {
    const messageTemplate = extractMutation(putRoomMessage)
    const messages = roomIds.map((permanentId) => (populateMutationVariables({
        template: messageTemplate,
        RoomId: permanentId,
        Message: message,
        Title: title,
        MessageType: 'ANNOUNCEMENT',
        FromCharacterId: '',
        MessageId: '',
        CreatedTime: ''
    })))
    return API.graphql(graphqlOperation(batchMutations(messages))).catch((err) => { console.log(err)})
}

export const announce = (message = 'Announcement!') => (dispatch, getState) => {
    const state = getState()
    const currentCharacter = getMyCurrentCharacter(state)
    const currentNeighborhood = getCurrentNeighborhood(state)
    const announcementTitle = `Announcement from ${(currentCharacter && currentCharacter.Name) || 'Unknown'} in ${(currentNeighborhood && currentNeighborhood.Name) || 'Vortex'}`
    if (currentCharacter) {
        const roomIds = (getRoomIdsInNeighborhood((currentNeighborhood && currentNeighborhood.permanentId) || null)(state)) || []
        dispatch(activateConfirmDialog({
            title: announcementTitle,
            message,
            content: `Are you sure you want to post this announcement?  It will be heard in ${roomIds.length} rooms.`,
            resolveButtonTitle: 'Announce!',
            resolve: () => {
                dispatch(broadcastMessage({ title: announcementTitle, message, roomIds }))
            }
        }))
    }    
}

export default announce