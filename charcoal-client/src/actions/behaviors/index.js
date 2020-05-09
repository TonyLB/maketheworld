import { getCurrentName, getCharacterId } from '../../selectors/connection'
import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { getCurrentRoom } from '../../selectors/currentRoom'

import { sendMessage } from '../messages.js'
import lookRoom from './lookRoom'
import lookCharacter from './lookCharacter'
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
    const currentRoom = getCurrentRoom(state)
    const currentName = getCurrentName(state)
    const characterId = getCharacterId(state)
    const charactersInRoom = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId: characterId })(state)
    if (entry.startsWith('look ')) {
        const characterMatch = charactersInRoom.find(({ Name }) => (Name.toLowerCase() === entry.slice(5).toLowerCase()))
        if (characterMatch) {
            return dispatch(lookCharacter(characterMatch))
        }
    }
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