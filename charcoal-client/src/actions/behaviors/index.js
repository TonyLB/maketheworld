import { sendMessage } from '../messages.js'
import lookRoom from './lookRoom'
import moveCharacter from './moveCharacter'
import goHome from './home'
import announce from './announce'
import shout from './shout'

export const parseCommand = (entry) => (dispatch, getState) => {
    if (entry === 'l' || entry === 'look') {
        return dispatch(lookRoom())
    }
    if (entry === 'home') {
        return dispatch(goHome())
    }
    const re = /^(\w+)\s+(.*)$/
    const match = re.exec(entry)
    if (match) {
        const [verb, object] = match.slice(1)
        if (verb.toLocaleLowerCase() === 'announce') {
            return dispatch(announce(object))
        }
        if (verb.toLocaleLowerCase() === 'shout') {
            return dispatch(shout(object))
        }
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