import { API, graphqlOperation } from 'aws-amplify'

import { v4 as uuidv4 } from 'uuid'

import { updateMessages } from '../../graphql/mutations'


import { getMyCharacterById } from '../../selectors/myCharacters'
import { getCurrentRoom } from '../../selectors/activeCharacter'
import { getActiveCharacterList } from '../../selectors/charactersInPlay'

import { activateConfirmDialog } from '../UI/confirmDialog'

export const sendShout = ({ message = '', roomIds = [], CharacterId, charactersInPlay }) => {
    const roomsAndCharacters = roomIds.map((roomId) => ({
        RoomId: roomId,
        Characters: Object.values(charactersInPlay).filter(({ RoomId }) => (RoomId === roomId)).map(({ CharacterId }) => (CharacterId))
    }))
    const messageUpdates = roomsAndCharacters.map(({ RoomId, Characters }) => ({
        putMessage: {
            DisplayProtocol: "Player",
            MessageId: uuidv4(),
            RoomId,
            Characters,
            PlayerMessage: {
                Message: message,
                CharacterId
            }
        }
    }))
    return API.graphql(graphqlOperation(updateMessages, { Updates: messageUpdates})).catch((err) => { console.log(err)})
}

export const shout = (CharacterId) => (message = 'Arrgh!') => (dispatch, getState) => {
    const state = getState()
    const currentCharacter = getMyCharacterById(CharacterId)(state)
    const currentRoom = getCurrentRoom(CharacterId)(state)
    const charactersInPlay = getActiveCharacterList(state)
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
                sendShout({ message: shoutMessage, roomIds, CharacterId, charactersInPlay })
            }
        }))
    }    
}

export default shout