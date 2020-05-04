import { getMyCurrentCharacter } from './myCharacters'
import { getActiveCharactersInRoom } from './charactersInPlay'

export const getCurrentRoom = ({ currentRoom }) => (currentRoom)

export const getVisibleExits = (state) => {
    const { Grants = [] } = getMyCurrentCharacter()(state)
    const { currentRoom, permanentHeaders } = state
    return currentRoom && currentRoom.Ancestry && currentRoom.Exits &&
        currentRoom.Exits.filter(({ Ancestry }) => {
            const ancestryList = Ancestry.split(':')
            const roomAncestryList = currentRoom.Ancestry.split(':')
            const returnVal = (ancestryList.find((PermanentId, index) => (
                (roomAncestryList.length < index || PermanentId !== roomAncestryList[index]) &&
                permanentHeaders &&
                permanentHeaders[PermanentId] &&
                permanentHeaders[PermanentId].visibility === 'Private' &&
                !(Grants.find(({ Resource, Actions }) => ((Resource === PermanentId) && Actions.includes('View')))))
            ))
            return !Boolean(returnVal)
        })
}
//
// getAvailableBehaviors tells what line entries will invoke special behaviors
// directly from the text line.  This is used to populate the autoComplete on
// the LineEntry component, to give people text help.
//
export const getAvailableBehaviors = (state) => {
    const { currentRoom } = state
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

export const getCurrentNeighborhood = ({ currentRoom, permanentHeaders }) => {
    if (currentRoom && currentRoom.ParentId) {
        return permanentHeaders[currentRoom.ParentId]
    }
    else {
        return null
    }
}