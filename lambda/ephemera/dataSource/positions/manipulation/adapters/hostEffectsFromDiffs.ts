import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { MembershipDiff } from '../../membership/types'
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
