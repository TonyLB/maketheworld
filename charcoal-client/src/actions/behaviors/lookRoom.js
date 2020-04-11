import { receiveMessage } from '../messages'

export const lookRoom = () => (dispatch, getState) => {
    const { currentRoom = {} } = getState()

    if (currentRoom) {
        const roomDescription = {
            Description: currentRoom.Description,
            Name: currentRoom.Name,
            RoomId: currentRoom.RoomId,
            Exits: currentRoom.Exits,
            Players: []
        }
        dispatch(receiveMessage({
            protocol: 'roomDescription',
            ...roomDescription
        }))
    }
}

export default lookRoom