import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { ObjectMembershipDiff } from '../membership/types'
import type { HostEffect } from '../types'

export type PlanObjectClearFromAllHostsArgs = {
    objectId: EphemeraObjectId;
    priorContainers: EphemeraMembershipHostId[];
}

export type ObjectClearTransferPlan = {
    hostEffects: HostEffect[];
    projection: ObjectMembershipDiff;
}

export const planObjectClearFromAllHosts = (
    args: PlanObjectClearFromAllHostsArgs
): ObjectClearTransferPlan => {
    const froms = [...args.priorContainers]
    const hostEffects: HostEffect[] = []

    for (const hostId of froms) {
        if (isEphemeraRoomId(hostId)) {
            hostEffects.push({ hostId, identityId: args.objectId, op: 'remove' })
        }
        else if (isEphemeraCharacterId(hostId)) {
            hostEffects.push({ hostId, identityId: args.objectId, op: 'remove' })
        }
    }

    return {
        hostEffects,
        projection: {
            froms,
            to: null,
            changed: froms.length > 0,
        },
    }
}
