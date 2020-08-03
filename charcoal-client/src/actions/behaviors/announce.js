import { API, graphqlOperation } from 'aws-amplify'
import { v4 as uuidv4 } from 'uuid'

import { updateMessages } from '../../graphql/mutations'

import { getMyCurrentCharacter } from '../../selectors/myCharacters'
import { getCurrentNeighborhood } from '../../selectors/currentRoom'
import { getRoomIdsInNeighborhood } from '../../selectors/permanentHeaders'
import { getActiveCharacterList } from '../../selectors/charactersInPlay'

import { activateConfirmDialog } from '../UI/confirmDialog'

export const sendAnnouncement = ({ title = 'Announcement', message = '', roomIds = [], charactersInPlay = {} }) => {
    const roomsAndCharacters = roomIds.map((roomId) => ({
        RoomId: roomId,
        Characters: Object.values(charactersInPlay).filter(({ RoomId }) => (RoomId === roomId)).map(({ CharacterId }) => (CharacterId))
    }))
    const messageUpdates = roomsAndCharacters.map(({ RoomId, Characters }) => ({
        putMessage: {
            DisplayProtocol: "Announce",
            MessageId: uuidv4(),
            Characters,
            RoomId,
            AnnounceMessage: {
                Title: title,
                Message: message
            }
        }
    }))
    return API.graphql(graphqlOperation(updateMessages, { Updates: messageUpdates})).catch((err) => { console.log(err)})

}

export const announce = (message = 'Announcement!') => (dispatch, getState) => {
    const state = getState()
    const currentCharacter = getMyCurrentCharacter(state)
    const currentNeighborhood = getCurrentNeighborhood(state)
    const charactersInPlay = getActiveCharacterList(state)
    const announcementTitle = `Announcement from ${(currentCharacter && currentCharacter.Name) || 'Unknown'} in ${(currentNeighborhood && currentNeighborhood.Name) || 'Vortex'}`
    if (currentCharacter) {
        const roomIds = (getRoomIdsInNeighborhood((currentNeighborhood && currentNeighborhood.PermanentId) || null)(state)) || []
        console.log(roomIds)
        dispatch(activateConfirmDialog({
            title: announcementTitle,
            message,
            content: `Are you sure you want to post this announcement?  It will be heard in ${roomIds.length} rooms.`,
            resolveButtonTitle: 'Announce!',
            resolve: () => {
                sendAnnouncement({ title: announcementTitle, message, roomIds, charactersInPlay })
            }
        }))
    }    
}

export default announce