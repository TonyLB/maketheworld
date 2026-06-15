import { ActionAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import internalCache from '../internalCache'
import { EphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'
import { excludeUndefined } from '@tonylb/mtw-utilities/ts/lists'

const getCurrentRoom = async (CharacterId: EphemeraCharacterId) => {
    const { RoomId } = await internalCache.CharacterMeta.get(CharacterId) || {}
    
    if (RoomId) {
        const standardForm = await internalCache.ComponentRender.get(CharacterId, RoomId)
        
        // Get the Room component using byUniversalId pattern like the client code
        const roomComponent = standardForm.byUniversalId[RoomId]
        
        if (roomComponent instanceof StandardRoom) {
            // Transform exits to the format expected by parseCommand
            const exits = roomComponent.exits.items.map(exitFacet => {
                const exitName = exitFacet.payload._payload.plain?.toJSON() ?? 'Unknown Exit'
                const targetRoomId = exitFacet.reference.universalKey || ''
                return { Name: exitName, RoomId: targetRoomId }
            })
            
            // Transform characters to the format expected by parseCommand
            // Note: We need to resolve character references to get actual character data
            const characters = roomComponent.characters.payload.map(characterRef => {
                const characterData = characterRef.toJSON()
                const characterId = typeof characterData === 'string' ? characterData : characterData.universalKey || ''
                // For now, return a basic structure - in a real implementation, 
                // we'd need to resolve the character to get the actual name
                return { Name: characterId, EphemeraId: characterId }
            })
            
            return { roomId: RoomId, exits, characters, features: [] }
        } else {
            // Fallback if component is not found or not a StandardRoom
            return { roomId: RoomId, exits: [], characters: [], features: [] }
        }
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
        return { message: 'action', actionType: 'look', payload: { CharacterId, EphemeraId: roomId } }
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
        
        // Check if it's an exit
        const exitMatch = exits.find(({ Name = '' }) => (Name.toLowerCase() === lookTarget))
        if (exitMatch) {
            return { message: 'action', actionType: 'look', payload: { CharacterId, EphemeraId: exitMatch.RoomId as any } }
        }
    }
    //
    // TODO: Add syntax for exit aliases, and expand the match here to include them
    //
    const matchedExit = exits.find(({ Name = '' }) => {
        const commandLower = command.toLowerCase().trim()
        const exitNameLower = Name.toLowerCase()
        return commandLower === exitNameLower || 
               commandLower === `go ${exitNameLower}`
    })
    
    //
    // TODO: MatchedExit should be type constrained so that the check on isEphemeraRoomId is not necessary
    //
    if (matchedExit && isEphemeraRoomId(matchedExit.RoomId)) {
        return { message: 'action', actionType: 'move', payload: { CharacterId, ExitName: matchedExit.Name, RoomId: matchedExit.RoomId } }
    }
    
    return undefined
}

