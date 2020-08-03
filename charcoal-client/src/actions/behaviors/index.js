import { getCurrentName, getCharacterId } from '../../selectors/connection'
import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { getCurrentRoom } from '../../selectors/currentRoom'

import { sendPlayerMessage } from '../messages.js'
import lookRoom from './lookRoom'
import lookCharacter from './lookCharacter'
import moveCharacter from './moveCharacter'
import goHome from './home'
import announce from './announce'
import shout from './shout'
import help from './help'

export const parseCommand = ({ entry, raiseError }) => (dispatch, getState) => {
    if (entry.match(/^\s*(?:look|l)\s*$/gi)) {
        dispatch(lookRoom())
        return true
    }
    if (entry.match(/^\s*home\s*$/gi)) {
        dispatch(goHome())
        return true
    }
    if (entry.match(/^\s*help\s*$/gi)) {
        dispatch(help())
        return true
    }
    const re = /^\s*(\w+)\s+(.*)$/gi
    const match = re.exec(entry)
    if (match) {
        const [verb, object] = match.slice(1)
        if (verb.toLocaleLowerCase() === 'announce') {
            dispatch(announce(object))
            return true
        }
        if (verb.toLocaleLowerCase() === 'shout') {
            dispatch(shout(object))
            return true
        }
    }
    const state = getState()
    const currentRoom = getCurrentRoom(state)
    const currentName = getCurrentName(state)
    const characterId = getCharacterId(state)
    const charactersInRoom = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId: characterId })(state)
    const lookMatch = (/^\s*(?:look|l)(?:\s+at)?\s+(.*)$/gi).exec(entry)
    if (lookMatch) {
        const object = lookMatch.slice(1)[0].toLowerCase().trim()
        const characterMatch = charactersInRoom.find(({ Name }) => (Name.toLowerCase() === object))
        if (characterMatch) {
            dispatch(lookCharacter(characterMatch))
            return true
        }
    }
    const matchedExit = currentRoom.Exits.find(({ Name }) => ( entry.toLowerCase().trim() === Name.toLowerCase() || entry.toLowerCase().trim() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        dispatch(moveCharacter({ ExitName: matchedExit.Name, RoomId: matchedExit.RoomId }))
        return true
    }
    if (entry.slice(0,1) === '"' && entry.length > 1) {
        dispatch(sendPlayerMessage({
            RoomId: currentRoom.PermanentId,
            CharacterId: characterId,
            Message: `${currentName} says "${entry.slice(1)}"`
        }))
        return true
    }
    if (entry.slice(0,1) === '@' && entry.length > 1) {
        dispatch(sendPlayerMessage({
            RoomId: currentRoom.PermanentId,
            CharacterId: characterId,
            Message: entry.slice(1)
        }))
        return true
    }
    if (entry.slice(0,1) === ':' && entry.length > 1) {
        dispatch(sendPlayerMessage({
            RoomId: currentRoom.PermanentId,
            CharacterId: characterId,
            Message: `${currentName}${entry.slice(1).match(/^[,']/) ? "" : " "}${entry.slice(1)}`
        }))
        return true
    }
    if (entry) {
        raiseError()
    }
    return false
}