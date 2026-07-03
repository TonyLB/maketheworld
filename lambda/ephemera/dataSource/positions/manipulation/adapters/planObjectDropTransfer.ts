import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { computeDropDiff } from './computeDropDiff'
import type { MembershipTransferPlan } from '../types'
import { hostEffectsFromObjectDropDiffs } from './hostEffectsFromDiffs'

export type PlanObjectDropTransferArgs = {
    objectId: EphemeraObjectId
    roomId: EphemeraRoomId
    characterId: EphemeraCharacterId
    priorContainers: EphemeraMembershipHostId[]
}

export const planObjectDropTransfer = (args: PlanObjectDropTransferArgs): MembershipTransferPlan => {
    const { diff, roomDiff, characterDiff } = computeDropDiff({
        priorContainers: args.priorContainers,
        roomId: args.roomId,
        characterId: args.characterId,
    })

    const hostEffects = diff.changed
        ? hostEffectsFromObjectDropDiffs({
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
