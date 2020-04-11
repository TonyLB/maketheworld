import { socketDispatch } from '../webSocket.js'
import lookRoom from './lookRoom'
import moveCharacter from './moveCharacter'

export const parseCommand = (entry) => (dispatch, getState) => {
    console.log(`Command: ${entry}`)
    if (entry === 'l' || entry === 'look') {
        return dispatch(lookRoom())
    }
    const { currentRoom } = getState()
    const matchedExit = currentRoom.Exits.find(({ Name }) => ( entry.toLowerCase() === Name.toLowerCase() || entry.toLowerCase() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        return dispatch(moveCharacter(matchedExit.RoomId))
    }
    return dispatch(socketDispatch('sendmessage')(entry))
}