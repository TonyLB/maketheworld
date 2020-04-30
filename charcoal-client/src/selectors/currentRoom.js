export const getCurrentRoom = ({ currentRoom }) => (currentRoom)

export const getVisibleExits = ({ currentRoom, permanentHeaders }) => {
    return currentRoom && currentRoom.Ancestry && currentRoom.Exits &&
        currentRoom.Exits.filter(({ Ancestry }) => {
            const ancestryList = Ancestry.split(':')
            const roomAncestryList = currentRoom.Ancestry.split(':')
            return !Boolean(ancestryList.find((PermanentId, index) => (
                PermanentId !== roomAncestryList[index] &&
                permanentHeaders &&
                permanentHeaders[PermanentId] &&
                permanentHeaders[PermanentId].visibility === 'Hidden')
            ))
        })
}
//
// getAvailableBehaviors tells what line entries will invoke special behaviors
// directly from the text line.  This is used to populate the autoComplete on
// the LineEntry component, to give people text help.
//
export const getAvailableBehaviors = ({ currentRoom, permanentHeaders }) => {
    const exitNames = (getVisibleExits({ currentRoom, permanentHeaders }) && currentRoom.Exits.map(({ Name }) => (Name.toLowerCase()))) || []
    return [
        'l',
        'look',
        'home',
        ...(exitNames),
        ...(exitNames.map((name) => (`go ${name}`)))
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