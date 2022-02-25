import { splitType, RoomKey } from '/opt/utilities/types.js'
import { ephemeraDB } from '/opt/utilities/dynamoDB/index.js'

const getCurrentRoom = async (CharacterId) => {
    const { RoomId } = await ephemeraDB.getItem({
        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
        DataCategory: 'Meta::Character',
        ProjectionFields: ['RoomId']
    })
    if (RoomId) {
        const Items = await ephemeraDB.query({
            EphemeraId: RoomKey(RoomId),
            ProjectionFields: ['DataCategory', 'appearances', 'activeCharacters']
        })
        const { exits, characters } = (Items
            .reduce((previous, { DataCategory, ...rest }) => {
                if (DataCategory === 'Meta::Room') {
                    return {
                        ...previous,
                        characters: Object.values(rest.activeCharacters || {})
                    }
                }
                const [tag, value] = splitType(DataCategory)
                if (tag === 'ASSET') {
                    //
                    // TODO: Look up what assets the character has a view of, and
                    // limit whether or not to include exits here.  Also, evaluate
                    // the conditions on each incoming exit, to make sure that
                    // they are valid before including.
                    //
                    return {
                        ...previous,
                        exits: rest.appearances
                            .map(({ exits = [] }) => (exits))
                            .reduce((accumulate, exits) => ([...accumulate, ...exits]), previous.exits)
                    }
                }
            }, { exits: [], characters: [] }))
        return { roomId: RoomId, exits, characters }
    }
    else {
        return { roomId: null, exits: [], characters: [] }
    }
}

export const parseCommand = async ({
    CharacterId,
    command
}) => {
    //
    // TODO: Build ControlChannel functions to parse free text entries looking for actions of
    // looking at characters, looking at the room, and traversing exits.  Replace the front-end
    // parsing with a round-trip call to the back-end parser.
    //

    const { roomId, exits, characters } = await getCurrentRoom(CharacterId)
    if (command.match(/^\s*(?:look|l)\s*$/gi)) {
        return { actionType: 'look', payload: { CharacterId, PermanentId: RoomKey(roomId) } }
    }
    if (command.match(/^\s*home\s*$/gi)) {
        return { actionType: 'home', payload: { CharacterId } }
    }
    const lookMatch = (/^\s*(?:look|l)(?:\s+at)?\s+(.*)$/gi).exec(command)
    if (lookMatch) {
        const object = lookMatch.slice(1)[0].toLowerCase().trim()
        const characterMatch = characters.find(({ Name }) => (Name.toLowerCase() === object))
        if (characterMatch) {
            //
            // TODO:  Build a perception function for looking at characters, and route to it here.
            //
            return {}
        }
    }
    //
    // TODO: Add syntax for exit aliases, and expand the match here to include them
    //
    const matchedExit = exits.find(({ name }) => ( command.toLowerCase().trim() === name.toLowerCase() || command.toLowerCase().trim() === `go ${name.toLowerCase()}`))
    if (matchedExit) {
        return { actionType: 'move', payload: { CharacterId, ExitName: matchedExit.name, RoomId: splitType(matchedExit.to)[1] } }
    }
    return {}
}

