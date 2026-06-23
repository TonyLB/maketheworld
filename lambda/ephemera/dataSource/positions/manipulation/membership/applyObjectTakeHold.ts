import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectComponentGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPlayPositionGraph } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import type { ObjectTakeHoldApplyArgs, TakeHoldApplyResult } from './types'
import {
    updateTakeHoldPositionGraphs,
    type UpdateTakeHoldPositionGraphsDependencies,
} from './updateTakeHoldPositionGraphs'

export type ApplyObjectTakeHoldDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    graphPersist?: UpdateTakeHoldPositionGraphsDependencies;
}

const seedRoomGraphMemos = (
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPlayPositionGraph>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPlayPositionGraph][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const seedCharacterGraphMemos = (
    postApplyCharacterGraphs: Partial<Record<EphemeraCharacterId, EphemeraPlayPositionGraph>>
): void => {
    for (const [characterId, storedGraph] of Object.entries(postApplyCharacterGraphs) as [EphemeraCharacterId, EphemeraPlayPositionGraph][]) {
        internalCache.Positions.set({
            componentId: characterId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

const roomIdsFromDiffFroms = (froms: string[]): EphemeraRoomId[] =>
    froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))

export const applyObjectTakeHold = async (
    args: ObjectTakeHoldApplyArgs,
    deps: ApplyObjectTakeHoldDependencies
): Promise<TakeHoldApplyResult> => {
    const result = await updateTakeHoldPositionGraphs(args, deps.graphPersist)

    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] updateTakeHoldPositionGraphs failed: ${result.errorMessage}`)
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

    seedRoomGraphMemos(result.postApplyRoomGraphs)
    seedCharacterGraphMemos(result.postApplyCharacterGraphs)
    internalCache.Positions.setMembershipContainers({
        componentId: args.objectId,
        containers: [args.characterId],
    })

    roomIdsFromDiffFroms(diff.froms).forEach((roomId) => {
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
