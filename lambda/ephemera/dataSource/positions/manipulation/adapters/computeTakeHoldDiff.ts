import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { MembershipDiff } from '../../membership/types'
import type { CharacterInventoryDiff } from '../membership/characterInventoryTransactItems'
import type { ObjectMembershipDiff } from '../membership/types'

export const computeTakeHoldDiff = (args: {
    priorContainers: EphemeraMembershipHostId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}): {
    diff: ObjectMembershipDiff;
    roomDiff: MembershipDiff;
    characterDiff: CharacterInventoryDiff;
} => {
    const priorRooms = args.priorContainers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))
    const priorCharacterHosts = args.priorContainers.filter(
        (id): id is EphemeraCharacterId => isEphemeraCharacterId(id)
    )

    const objectInSourceRoom = priorRooms.includes(args.roomId)
    const objectOnTargetCharacter = priorCharacterHosts.includes(args.characterId)
    const needsRoomRemove = objectInSourceRoom
    const needsCharacterAdd = !objectOnTargetCharacter
    const needsCharacterMove = priorCharacterHosts.some((hostId) => hostId !== args.characterId)
    const changed = needsRoomRemove || needsCharacterAdd || needsCharacterMove

    const diff: ObjectMembershipDiff = {
        froms: needsRoomRemove ? [args.roomId] : [],
        to: args.characterId,
        changed,
    }

    const roomDiff: MembershipDiff = {
        froms: needsRoomRemove ? [args.roomId] : [],
        to: null,
        changed: needsRoomRemove,
    }

    const characterDiff: CharacterInventoryDiff = {
        froms: priorCharacterHosts.filter((hostId) => hostId !== args.characterId),
        to: args.characterId,
        changed: needsCharacterAdd || needsCharacterMove,
    }

    return { diff, roomDiff, characterDiff }
}
