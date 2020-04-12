import { receiveMessage } from '../messages'
import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { getCharacterId } from '../../selectors/connection'

export const lookRoom = (props) => (dispatch, getState) => {
    const { Recap = false } = props || {}
    const state = getState()
    const { currentRoom = {} } = state
    const myCharacterId = getCharacterId(state)

    if (currentRoom && currentRoom.Name) {
        const Players = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId })(state)
        const roomDescription = {
            Description: currentRoom.Description,
            Name: currentRoom.Name,
            RoomId: currentRoom.RoomId,
            Exits: currentRoom.Exits,
            Players,
            ...( Recap ? { Recap: currentRoom.Recap } : {})
        }
        dispatch(receiveMessage({
            protocol: 'roomDescription',
            ...roomDescription
        }))
    }
    else {
        console.log('No currentRoom data!')
    }
}

export default lookRoom