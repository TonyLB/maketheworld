import { splitType, RoomKey } from '@tonylb/mtw-utilities/dist/types.js'
import { ActionAPIMessage } from '@tonylb/mtw-interfaces/dist/ephemera'
import { render } from '@tonylb/mtw-utilities/dist/perception/index.js'
import internalCache from '../internalCache'

const getCurrentRoom = async (CharacterId: string) => {
    const { RoomId } = await internalCache.CharacterMeta.get(CharacterId) || {}
    //
    // TODO: Abstract perception render to a ComponentRender internalCache, and use
    // it here as well.
    //
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
}: { CharacterId: string; command: string; }): Promise<ActionAPIMessage | undefined> => {
    const { roomId, exits, characters, features } = await getCurrentRoom(CharacterId)
    if (command.match(/^\s*(?:look|l)\s*$/gi) && roomId) {
        return { message: 'action', actionType: 'look', payload: { CharacterId, EphemeraId: RoomKey(roomId) } }
    }
    if (command.match(/^\s*home\s*$/gi)) {
        return { message: 'action', actionType: 'home', payload: { CharacterId } }
    }
    const lookMatch = (/^\s*(?:look|l)(?:\s+at)?\s+(.*)$/gi).exec(command)
    if (lookMatch) {
        const lookTarget = lookMatch.slice(1)[0].toLowerCase().trim()
        const characterMatch = characters.find(({ Name = '' }) => (Name.toLowerCase() === lookTarget))
        if (characterMatch) {
            //
            // TODO:  Build a perception function for looking at characters, and route to it here.
            //
            return undefined
        }
        const featureMatch = features.find(({ name = '' }) => (name.toLowerCase() === lookTarget))
        if (featureMatch) {
            return { message: 'action', actionType: 'look', payload: { CharacterId, EphemeraId: featureMatch.EphemeraId }}
        }
    }
    //
    // TODO: Add syntax for exit aliases, and expand the match here to include them
    //
    const matchedExit = exits.find(({ Name = '' }) => ( command.toLowerCase().trim() === Name.toLowerCase() || command.toLowerCase().trim() === `go ${Name.toLowerCase()}`))
    if (matchedExit) {
        return { message: 'action', actionType: 'move', payload: { CharacterId, ExitName: matchedExit.Name, RoomId: matchedExit.RoomId } }
    }
    return undefined
}

