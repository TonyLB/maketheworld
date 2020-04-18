export const getCurrentRoom = ({ currentRoom }) => (currentRoom)

//
// getAvailableBehaviors tells what line entries will invoke special behaviors
// directly from the text line.  This is used to populate the autoComplete on
// the LineEntry component, to give people text help.
//
export const getAvailableBehaviors = ({ currentRoom }) => {
    const exitNames = (currentRoom && currentRoom.Exits && currentRoom.Exits.map(({ Name }) => (Name.toLowerCase()))) || []
    return [
        'l',
        'look',
        'home',
        ...(exitNames),
        ...(exitNames.map((name) => (`go ${name}`)))
    ]
}