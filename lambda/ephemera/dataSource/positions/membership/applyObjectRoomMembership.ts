import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectRoomGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../internalCache'
import getCurrentTimestamp from '../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../publishedEvents'
import { buildObjectMovedFact } from './buildObjectMovedFact'
import { streamObjectMembershipFact } from './streamObjectMembershipFact'
import type { MembershipApplyResult, ObjectMembershipApplyArgs } from './types'
import {
    updateObjectPositionGraphs,
    type UpdateObjectPositionGraphsDependencies,
} from './updateObjectPositionGraphs'

export type ApplyObjectRoomMembershipDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    graphPersist?: UpdateObjectPositionGraphsDependencies;
}

const seedPositionsGraphMemos = (
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPlayPositionGraph][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectRoomGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const affectedRoomsFromDiff = (froms: EphemeraRoomId[], to: EphemeraRoomId | null): EphemeraRoomId[] =>
    [...new Set([...froms, ...(to ? [to] : [])])]

export const applyObjectRoomMembership = async (
    args: ObjectMembershipApplyArgs,
    deps: ApplyObjectRoomMembershipDependencies
): Promise<MembershipApplyResult> => {
    const result = await updateObjectPositionGraphs(args, deps.graphPersist)

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] updateObjectPositionGraphs failed: ${result.errorMessage}`)
        return result
    }

    const { diff } = result

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    if (!result.persisted) {
        return { ok: true, ...diff }
    }

    const beatAnchorTime = getCurrentTimestamp()

    const fact = buildObjectMovedFact({
        objectId: args.objectId,
        diff,
        beatAnchorTime,
    })
    if (fact) {
        await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

    const affectedRooms = affectedRoomsFromDiff(diff.froms, diff.to)
    seedPositionsGraphMemos(result.postApplyRoomGraphs)
    internalCache.Positions.setMembershipContainers({
        componentId: args.objectId,
        containers: diff.to ? [diff.to] : [],
    })

    affectedRooms.forEach((roomId) => {
        deps.messageBus.publish({
            type: 'RoomUpdate',
            roomId,
        })
    })

    return {
        ok: true,
        ...diff,
        beatAnchorTime,
    }
}
