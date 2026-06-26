import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { PlayPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'

import type { MembershipDiff } from './types'
import {
    addObjectToGraph,
    playPositionGraphToStoredTopology,
    removeObjectFromGraph,
} from './positionGraphMerge'

/**
 * Diff-shaped post-apply graph projection for cache seeding when persist bypasses
 * applyHostEffects. Sole caller today: spawnAndPlaceImprovisationObject (spawn bundle).
 * Follow-up: align spawn bundle with kernel; then remove this module.
 */
const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

export const computePostApplyObjectRoomGraphs = async (
    objectId: EphemeraObjectId,
    diff: MembershipDiff,
    getRoomPositionGraph: (roomId: EphemeraRoomId) => Promise<PlayPositionGraph>
): Promise<Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>> => {
    const postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>> = {}
    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)

    await Promise.all(
        affectedRooms.map(async (roomId) => {
            const priorStored = playPositionGraphToStoredTopology(await getRoomPositionGraph(roomId))
            if (diff.froms.includes(roomId)) {
                postApplyRoomGraphs[roomId] = removeObjectFromGraph(priorStored, objectId)
            }
            if (diff.to === roomId) {
                postApplyRoomGraphs[roomId] = addObjectToGraph(priorStored, objectId)
            }
        })
    )

    return postApplyRoomGraphs
}
