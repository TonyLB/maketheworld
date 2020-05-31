import { getMyCurrentCharacter } from './myCharacters'
import { getActiveCharactersInRoom } from './charactersInPlay'
import { getCurrentRoomId } from './connection'
import { getPermanentHeaders } from './permanentHeaders'

export const getCurrentRoom = (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    const RoomId = getCurrentRoomId(state)
    return (permanentHeaders && RoomId && permanentHeaders[RoomId]) || {}
}

//
// getVisibleExits checks all exits from the room, and their Neighborhood ancestry,
// tags exits with whether they are public-access, or private, and if private checks
// for all necessary grants.  Does not return exits that the player does not have a
// grant to view.
//
export const getVisibleExits = (state) => {
    const permanentHeaders = getPermanentHeaders(state)
    const { Grants = {} } = getMyCurrentCharacter(state)
    const currentRoom = getCurrentRoom(state)
    return currentRoom && currentRoom.Ancestry && currentRoom.Exits &&
        currentRoom.Exits.map(({ RoomId = '', ...rest }) => {
                const Ancestry = permanentHeaders[RoomId].Ancestry || ''
                const ancestryList = Ancestry.split(':')
                const roomAncestryList = currentRoom.Ancestry.split(':')
                const checkNeighborhoods = ancestryList.filter((PermanentId, index) => (
                    (roomAncestryList.length < index || PermanentId !== roomAncestryList[index]) &&
                    permanentHeaders &&
                    permanentHeaders[PermanentId] &&
                    permanentHeaders[PermanentId].Visibility === 'Private'))
                const returnVal = checkNeighborhoods.reduce((previous, PermanentId) => (
                    (Grants[PermanentId] || {}).View
                        ? { ...previous, Visibility: 'Private' }
                        : { Visibility: 'Private', visible: false }
                ), { Visibility: 'Public', visible: true })
                return { RoomId, ...rest, ...returnVal }
            })
            .filter(({ visible }) => (visible))
            .map(({ visible, ...rest }) => (rest))
}

//
// getAvailableBehaviors tells what line entries will invoke special behaviors
// directly from the text line.  This is used to populate the autoComplete on
// the LineEntry component, to give people text help.
//
export const getAvailableBehaviors = (state) => {
    const currentRoom = getCurrentRoom(state)
    const exitNames = (getVisibleExits(state) && currentRoom.Exits.map(({ Name }) => (Name.toLowerCase()))) || []
    const characterNames = getActiveCharactersInRoom({ RoomId: currentRoom.PermanentId })(state)
    return [
        'l',
        'look',
        'help',
        'home',
        ...(exitNames),
        ...(exitNames.map((name) => (`go ${name}`))),
        ...(characterNames.map(({ Name }) => (`look ${Name.toLowerCase()}`)))
    ]
}

export const getCurrentNeighborhood = (state) => {
    const currentRoom = getCurrentRoom(state)
    const permanentHeaders = getPermanentHeaders(state)
    if (currentRoom && currentRoom.ParentId) {
        return permanentHeaders[currentRoom.ParentId]
    }
    else {
        return null
    }
}