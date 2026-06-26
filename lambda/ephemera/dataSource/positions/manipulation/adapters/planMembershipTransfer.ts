import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { computeMembershipDiff } from '../../membership/updatePositionGraphs'
import type { MembershipDiff } from '../../membership/types'
import type { MembershipTransferPlan } from '../types'
import { hostEffectsFromRoomMembershipDiff } from './hostEffectsFromDiffs'

export type PlanMembershipTransferArgs = {
    entityId: EphemeraCharacterId | EphemeraObjectId
    entityKind: 'character' | 'object'
    applyMode: 'end-state' | 'bounded'
    target: EphemeraMembershipHostId | null
    boundedHostIds?: EphemeraMembershipHostId[]
    priorContainers: EphemeraMembershipHostId[]
}

const priorRoomContainers = (priorContainers: EphemeraMembershipHostId[]): EphemeraRoomId[] =>
    priorContainers.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))

const computeBoundedRoomDiff = (
    priorRooms: EphemeraRoomId[],
    boundedHostIds: EphemeraMembershipHostId[],
    target: EphemeraMembershipHostId | null
): MembershipDiff => {
    const boundedRooms = boundedHostIds.filter(isEphemeraRoomId)
    const froms = boundedRooms.filter((roomId) => priorRooms.includes(roomId))
    const targetRoom = target !== null && isEphemeraRoomId(target) ? target : null
    const needsAdd = targetRoom !== null && !priorRooms.includes(targetRoom)
    const changed = froms.length > 0 || needsAdd
    return { froms, to: targetRoom, changed }
}

export const planMembershipTransfer = (args: PlanMembershipTransferArgs): MembershipTransferPlan => {
    const priorRooms = priorRoomContainers(args.priorContainers)

    let diff: MembershipDiff

    if (args.applyMode === 'end-state') {
        const targetRoom = args.target !== null && isEphemeraRoomId(args.target) ? args.target : null
        diff = computeMembershipDiff(priorRooms, targetRoom)
    }
    else {
        if (!args.boundedHostIds?.length) {
            throw new Error('planMembershipTransfer: bounded mode requires boundedHostIds')
        }
        diff = computeBoundedRoomDiff(priorRooms, args.boundedHostIds, args.target)
    }

    const hostEffects = diff.changed
        ? hostEffectsFromRoomMembershipDiff(args.entityId, args.entityKind, diff)
        : []

    return {
        hostEffects,
        projection: {
            froms: diff.froms,
            to: diff.to,
            changed: diff.changed,
        },
    }
}
