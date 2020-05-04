import { getCurrentName, getCharacterId } from '../../selectors/connection'

import { sendMessage } from '../messages.js'
import lookRoom from './lookRoom'
import moveCharacter from './moveCharacter'
import goHome from './home'
import announce from './announce'
import shout from './shout'
import help from './help'

export const parseCommand = ({ entry, raiseError }) => (dispatch, getState) => {
    if (entry === 'l' || entry === 'look') {
        return dispatch(lookRoom())
    }
    if (entry === 'home') {
        return dispatch(goHome())
    }
    if (entry === 'help') {
        return dispatch(help())
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
    const { currentRoom } = state
    const currentName = getCurrentName(state)
    const characterId = getCharacterId(state)
    const matchedExit = currentRoom.Exits.find(({ Name }) => ( entry.toLowerCase() === Name.toLowerCase() || entry.toLowerCase() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        return dispatch(moveCharacter({ ExitName: matchedExit.Name, RoomId: matchedExit.RoomId }))
    }
    if (entry.slice(0,1) === '"' && entry.length > 1) {
        return sendMessage({
            RoomId: currentRoom.PermanentId,
            FromCharacterId: characterId,
            Message: `${currentName} says "${entry.slice(1)}"`
        })
    }
    if (entry.slice(0,1) === '@' && entry.length > 1) {
        return sendMessage({
            RoomId: currentRoom.PermanentId,
            FromCharacterId: characterId,
            Message: entry.slice(1)
        })
    }
    if (entry.slice(0,1) === ':' && entry.length > 1) {
        return sendMessage({
            RoomId: currentRoom.PermanentId,
            FromCharacterId: characterId,
            Message: `${currentName}${entry.slice(1).match(/^[,']/) ? "" : " "}${entry.slice(1)}`
        })
    }
    if (entry) {
        raiseError()
    }
    return false
}