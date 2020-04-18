import { sendMessage } from '../messages.js'
import lookRoom from './lookRoom'
import moveCharacter from './moveCharacter'
import goHome from './home'

export const parseCommand = (entry) => (dispatch, getState) => {
    console.log(`Command: ${entry}`)
    if (entry === 'l' || entry === 'look') {
        return dispatch(lookRoom())
    }
    if (entry === 'home') {
        return dispatch(goHome())
    }
    const state = getState()
    const { currentRoom, connection } = state
    const matchedExit = currentRoom.Exits.find(({ Name }) => ( entry.toLowerCase() === Name.toLowerCase() || entry.toLowerCase() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        return dispatch(moveCharacter({ ExitName: matchedExit.Name, RoomId: matchedExit.RoomId }))
    }
    return sendMessage({
        RoomId: currentRoom.PermanentId,
        FromCharacterId: connection.characterId,
        Message: entry
    })
}