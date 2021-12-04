import { getCurrentRoom } from '../../selectors/activeCharacter'
import { getActiveCharactersInRoom } from '../../selectors/charactersInPlay'
import { socketDispatch } from '../communicationsLayer/lifeLine'

import lookRoom from './lookRoom'
import lookCharacter from './lookCharacter'
import moveCharacter from './moveCharacter'
import goHome from './home'
import help from './help'

export const parseCommand = (CharacterId) => ({ entry, raiseError }) => (dispatch, getState) => {
    if (entry.match(/^\s*(?:look|l)\s*$/gi)) {
        dispatch(lookRoom(CharacterId)())
        return true
    }
    if (entry.match(/^\s*home\s*$/gi)) {
        dispatch(goHome(CharacterId))
        return true
    }
    if (entry.match(/^\s*help\s*$/gi)) {
        dispatch(help())
        return true
    }
    const re = /^\s*(\w+)\s+(.*)$/gi
    const state = getState()
    const currentRoom = getCurrentRoom(CharacterId)(state)
    const charactersInRoom = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId, myCharacterId: CharacterId })(state)
    const lookMatch = (/^\s*(?:look|l)(?:\s+at)?\s+(.*)$/gi).exec(entry)
    if (lookMatch) {
        const object = lookMatch.slice(1)[0].toLowerCase().trim()
        const characterMatch = charactersInRoom.find(({ Name }) => (Name.toLowerCase() === object))
        if (characterMatch) {
            dispatch(lookCharacter(CharacterId)(characterMatch))
            return true
        }
    }
    const matchedExit = currentRoom.Exits.find(({ Name }) => ( entry.toLowerCase().trim() === Name.toLowerCase() || entry.toLowerCase().trim() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        dispatch(moveCharacter({ ExitName: matchedExit.Name, RoomId: matchedExit.RoomId }))
        return true
    }
    if (entry.slice(0,1) === '"' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'say', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry.slice(0,1) === '@' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'spoof', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry.slice(0,1) === ':' && entry.length > 1) {
        dispatch(socketDispatch('action')({ actionType: 'pose', payload: { CharacterId, Message: entry.slice(1) } }))
        return true
    }
    if (entry) {
        raiseError()
    }
    return false
}