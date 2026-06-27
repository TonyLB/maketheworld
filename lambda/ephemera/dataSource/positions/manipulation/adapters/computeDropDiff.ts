import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { MembershipDiff } from '../../membership/types'
import type { CharacterInventoryDiff } from '../membership/characterInventoryTransactItems'
import type { ObjectMembershipDiff } from '../membership/types'

export const computeDropDiff = (args: {
    priorContainers: EphemeraMembershipHostId[];
    roomId: EphemeraRoomId;
    characterId: EphemeraCharacterId;
}): {
    diff: ObjectMembershipDiff;
    roomDiff: MembershipDiff;
    characterDiff: CharacterInventoryDiff;
} => {
    const objectOnSourceCharacter = args.priorContainers.includes(args.characterId)
    const objectInDestinationRoom = args.priorContainers.includes(args.roomId)
    const needsCharacterRemove = objectOnSourceCharacter
    const needsRoomAdd = !objectInDestinationRoom
    const changed = needsCharacterRemove || needsRoomAdd

    const diff: ObjectMembershipDiff = {
        froms: needsCharacterRemove ? [args.characterId] : [],
        to: args.roomId,
        changed,
    }

    const roomDiff: MembershipDiff = {
        froms: [],
        to: needsRoomAdd ? args.roomId : null,
        changed: needsRoomAdd,
    }

    const characterDiff: CharacterInventoryDiff = {
        froms: needsCharacterRemove ? [args.characterId] : [],
        to: null,
        changed: needsCharacterRemove,
    }

    return { diff, roomDiff, characterDiff }
}
