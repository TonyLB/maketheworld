import {
    EphemeraCharacterId,
    EphemeraRoomId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'
import { StandardRoom } from '@tonylb/mtw-wml/ts/standardize/components/room'

import internalCache from '../../internalCache'

export type RoomExitTargetsForCharacter = {
    fromRoomId: EphemeraRoomId | null
    /** Distinct room ids reachable via an exit from the character's current room. */
    toRoomIds: EphemeraRoomId[]
    /** Exit labels resolved from room render, normalized for deterministic parse matching. */
    exits: {
        normalizedName: string
        toRoomId: EphemeraRoomId
    }[]
}

const normalizeExitName = (name: string): string => (
    name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
)

/**
 * Resolves the character's current room and exit destination room ids from rendered room WML.
 */
export async function getRoomExitTargetsForCharacter(
    characterId: EphemeraCharacterId
): Promise<RoomExitTargetsForCharacter> {
    const { RoomId } = await internalCache.CharacterMeta.get(characterId) || {}
    if (!RoomId || !isEphemeraRoomId(RoomId)) {
        return { fromRoomId: null, toRoomIds: [], exits: [] }
    }
    const standardForm = await internalCache.ComponentRender.get(characterId, RoomId)
    const roomComponent = standardForm.byUniversalId[RoomId]
    if (!(roomComponent instanceof StandardRoom)) {
        return { fromRoomId: RoomId, toRoomIds: [], exits: [] }
    }
    const exits = roomComponent.exits.items.flatMap((exitFacet) => {
        const toRoomId = exitFacet.reference.universalKey || ''
        if (!isEphemeraRoomId(toRoomId)) {
            return []
        }
        const normalizedName = normalizeExitName(exitFacet.payload._payload.plain?.toJSON() ?? '')
        if (!normalizedName) {
            return []
        }
        return [{ normalizedName, toRoomId }]
    })
    const toRoomIds = roomComponent.exits.items
        .map((exitFacet) => exitFacet.reference.universalKey || '')
        .filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
    return { fromRoomId: RoomId, toRoomIds: [...new Set(toRoomIds)], exits }
}
