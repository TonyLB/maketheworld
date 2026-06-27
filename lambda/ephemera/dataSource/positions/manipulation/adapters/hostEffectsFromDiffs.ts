import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { MembershipDiff } from '../../membership/types'
import type { CharacterInventoryDiff } from '../membership/characterInventoryTransactItems'
import type { HostEffect } from '../types'

export const hostEffectsFromRoomMembershipDiff = (
    entityId: EphemeraCharacterId | EphemeraObjectId,
    entityKind: 'character' | 'object',
    diff: MembershipDiff
): HostEffect[] => {
    const effects: HostEffect[] = []

    for (const departureRoomId of diff.froms) {
        if (entityKind === 'character') {
            effects.push({
                hostId: departureRoomId,
                identityId: entityId as EphemeraCharacterId,
                op: 'remove',
            })
        }
        else {
            effects.push({
                hostId: departureRoomId,
                identityId: entityId as EphemeraObjectId,
                op: 'remove',
            })
        }
    }

    if (diff.to) {
        if (entityKind === 'character') {
            effects.push({
                hostId: diff.to,
                identityId: entityId as EphemeraCharacterId,
                op: 'add',
            })
        }
        else {
            effects.push({
                hostId: diff.to,
                identityId: entityId as EphemeraObjectId,
                op: 'add',
            })
        }
    }

    return effects
}

export const hostEffectsFromObjectTakeHoldDiffs = (args: {
    objectId: EphemeraObjectId
    roomDiff: MembershipDiff
    characterDiff: CharacterInventoryDiff
}): HostEffect[] => {
    const effects: HostEffect[] = []

    if (args.roomDiff.changed) {
        for (const departureRoomId of args.roomDiff.froms) {
            effects.push({
                hostId: departureRoomId,
                identityId: args.objectId,
                op: 'remove',
            })
        }
    }

    if (args.characterDiff.changed) {
        for (const departureCharacterId of args.characterDiff.froms) {
            effects.push({
                hostId: departureCharacterId,
                identityId: args.objectId,
                op: 'remove',
            })
        }

        if (args.characterDiff.to) {
            effects.push({
                hostId: args.characterDiff.to,
                identityId: args.objectId,
                op: 'add',
            })
        }
    }

    return effects
}

export const hostEffectsFromObjectDropDiffs = (args: {
    objectId: EphemeraObjectId
    roomDiff: MembershipDiff
    characterDiff: CharacterInventoryDiff
}): HostEffect[] => [
    ...(args.characterDiff.changed
        ? args.characterDiff.froms.map((departureCharacterId): HostEffect => ({
            hostId: departureCharacterId,
            identityId: args.objectId,
            op: 'remove',
        }))
        : []),
    ...(args.roomDiff.changed && args.roomDiff.to
        ? [{
            hostId: args.roomDiff.to,
            identityId: args.objectId,
            op: 'add',
        } satisfies HostEffect]
        : []),
]
