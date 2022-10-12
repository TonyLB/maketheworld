import { RoomKey } from '@tonylb/mtw-utilities/dist/types.js'
import { ActionAPIMessage, EphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/dist/ephemera'
import internalCache from '../internalCache'

const getCurrentRoom = async (CharacterId: EphemeraCharacterId) => {
    const { RoomId } = await internalCache.CharacterMeta.get(CharacterId) || {}
    //
    // TODO: Abstract perception render to a ComponentRender internalCache, and use
    // it here as well.
    //
    if (RoomId) {
        const { Exits: exits, Characters: characters } = await internalCache.ComponentRender.get(`CHARACTER#${CharacterId}`, `ROOM#${RoomId}`)

        return { roomId: RoomId, exits, characters, features: [] }
    }
    else {
        return { roomId: null, exits: [], characters: [], features: [] }
    }
}

export const parseCommand = async ({
    CharacterId,
    command
}: { CharacterId: EphemeraCharacterId; command: string; }): Promise<ActionAPIMessage | undefined> => {
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
        // const featureMatch = features.find(({ name = '' }) => (name.toLowerCase() === lookTarget))
        // if (featureMatch) {
        //     return { message: 'action', actionType: 'look', payload: { CharacterId, EphemeraId: featureMatch.EphemeraId }}
        // }
    }
    //
    // TODO: Add syntax for exit aliases, and expand the match here to include them
    //
    const matchedExit = exits.find(({ Name = '' }) => ( command.toLowerCase().trim() === Name.toLowerCase() || command.toLowerCase().trim() === `go ${Name.toLowerCase()}`))
    //
    // TODO: MatchedExit should be type constrained so that the check on isEphemeraRoomId is not necessary
    //
    if (matchedExit && isEphemeraRoomId(matchedExit.RoomId)) {
        return { message: 'action', actionType: 'move', payload: { CharacterId, ExitName: matchedExit.Name, RoomId: matchedExit.RoomId } }
    }
    return undefined
}

