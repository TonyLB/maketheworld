import { splitType, RoomKey } from '@tonylb/mtw-utilities/dist/types.js'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB/index.js'
import { render } from '@tonylb/mtw-utilities/dist/perception/index.js'

const getCurrentRoom = async (CharacterId) => {
    const { RoomId } = await ephemeraDB.getItem({
        EphemeraId: `CHARACTERINPLAY#${CharacterId}`,
        DataCategory: 'Meta::Character',
        ProjectionFields: ['RoomId']
    })
    if (RoomId) {
        const [{
            Exits: exits = [],
            Characters: characters = [],
            Features: features = []
        } = {}] = await render({
            renderList: [{
                CharacterId,
                EphemeraId: RoomKey(RoomId)
            }]
        })    

        return { roomId: RoomId, exits, characters, features }
    }
    else {
        return { roomId: null, exits: [], characters: [], features: [] }
    }
}

export const parseCommand = async ({
    CharacterId,
    command
}) => {
    const { roomId, exits, characters, features } = await getCurrentRoom(CharacterId)
    if (command.match(/^\s*(?:look|l)\s*$/gi)) {
        return { actionType: 'look', payload: { CharacterId, PermanentId: RoomKey(roomId) } }
    }
    if (command.match(/^\s*home\s*$/gi)) {
        return { actionType: 'home', payload: { CharacterId } }
    }
    const lookMatch = (/^\s*(?:look|l)(?:\s+at)?\s+(.*)$/gi).exec(command)
    if (lookMatch) {
        const lookTarget = lookMatch.slice(1)[0].toLowerCase().trim()
        const characterMatch = characters.find(({ Name = '' }) => (Name.toLowerCase() === lookTarget))
        if (characterMatch) {
            //
            // TODO:  Build a perception function for looking at characters, and route to it here.
            //
            return {}
        }
        const featureMatch = features.find(({ name = '' }) => (name.toLowerCase() === lookTarget))
        if (featureMatch) {
            //
            // TODO:  Build a perception function for looking at characters, and route to it here.
            //
            return { actionType: 'look', payload: { CharacterId, PermanentId: featureMatch.EphemeraId }}
        }
    }
    //
    // TODO: Add syntax for exit aliases, and expand the match here to include them
    //
    const matchedExit = exits.find(({ Name = '' }) => ( command.toLowerCase().trim() === Name.toLowerCase() || command.toLowerCase().trim() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        return { actionType: 'move', payload: { CharacterId, ExitName: matchedExit.Name, RoomId: matchedExit.RoomId } }
    }
    return {}
}

