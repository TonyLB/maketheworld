import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { MembershipDiff } from '../../membership/types'

const containersChanged = (priorContainers: EphemeraRoomId[], targetRoomId: EphemeraRoomId | null): boolean => {
    const priorSet = new Set(priorContainers)
    const endSet = new Set(targetRoomId ? [targetRoomId] : [])
    if (priorSet.size !== endSet.size) {
        return true
    }
    return [...priorSet].some((roomId) => !endSet.has(roomId))
}

export const computeMembershipDiff = (
    priorContainers: EphemeraRoomId[],
    targetRoomId: EphemeraRoomId | null
): MembershipDiff => {
    const to = targetRoomId
    const froms = priorContainers.filter((roomId) => roomId !== to)
    return {
        froms,
        to,
        changed: containersChanged(priorContainers, targetRoomId),
    }
}
