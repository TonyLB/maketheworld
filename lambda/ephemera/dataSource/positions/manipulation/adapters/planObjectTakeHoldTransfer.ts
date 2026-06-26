import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { computeTakeHoldDiff } from '../membership/updateTakeHoldPositionGraphs'
import type { MembershipTransferPlan } from '../types'
import { hostEffectsFromObjectTakeHoldDiffs } from './hostEffectsFromDiffs'

export type PlanObjectTakeHoldTransferArgs = {
    objectId: EphemeraObjectId
    roomId: EphemeraRoomId
    characterId: EphemeraCharacterId
    priorContainers: EphemeraMembershipHostId[]
}

export const planObjectTakeHoldTransfer = (args: PlanObjectTakeHoldTransferArgs): MembershipTransferPlan => {
    const { diff, roomDiff, characterDiff } = computeTakeHoldDiff({
        priorContainers: args.priorContainers,
        roomId: args.roomId,
        characterId: args.characterId,
    })

    const hostEffects = diff.changed
        ? hostEffectsFromObjectTakeHoldDiffs({
            objectId: args.objectId,
            roomDiff,
            characterDiff,
        })
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
