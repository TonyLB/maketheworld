import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { projectComponentGraphFromStoredPositionGraph } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPositionGraphFieldPayload } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { applyHostRelationalPatch, type ApplyHostRelationalPatchDependencies } from '../applyHostRelationalPatch'
import { buildObjectRelationalFact } from './buildObjectRelationalFact'
import { planHostRelationalPatch } from './planHostRelationalPatch'
import { streamObjectRelationalFact } from './streamObjectRelationalFact'
import type { RelationalApplyResult, RelationalIngressArgs } from './types'

export type ApplyObjectRelationalChangeDependencies = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    kernelPersist?: ApplyHostRelationalPatchDependencies
}

const seedRoomGraphMemos = (
    postApplyRoomGraphs: Partial<Record<EphemeraRoomId, EphemeraPositionGraphFieldPayload>>
): void => {
    for (const [roomId, storedGraph] of Object.entries(postApplyRoomGraphs) as [EphemeraRoomId, EphemeraPositionGraphFieldPayload][]) {
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        internalCache.AffordanceRoomDeliverable.invalidate(roomId)
        internalCache.Positions.set({
            componentId: roomId,
            graph: projectComponentGraphFromStoredPositionGraph(storedGraph),
        })
    }
}

export const applyObjectRelationalChange = async (
    args: RelationalIngressArgs,
    deps: ApplyObjectRelationalChangeDependencies
): Promise<RelationalApplyResult> => {
    const plan = await planHostRelationalPatch(args, deps.kernelPersist)

    if (!plan.changed) {
        return { ok: true, changed: false }
    }

    const kernelResult = await applyHostRelationalPatch(
        { patches: [plan.patch] },
        deps.kernelPersist
    )

    if (!kernelResult.ok) {
        console.error(`[mtw.ephemera.positions] applyHostRelationalPatch failed: ${kernelResult.errorMessage}`)
        return {
            ok: false,
            errorCode: kernelResult.errorCode,
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true, changed: false }
    }

    const beatAnchorTime = getCurrentTimestamp()
    const fact = buildObjectRelationalFact({
        subjectId: args.subjectId,
        targetId: args.targetId,
        hostRoomId: args.roomId,
        relationKind: args.relationKind,
        relationLabel: args.relationLabel,
        operation: args.operation,
        beatAnchorTime,
    })

    await streamObjectRelationalFact(fact, { streamEvent: deps.streamEvent })
    seedRoomGraphMemos(kernelResult.postApplyGraphs)

    deps.messageBus.publish({
        type: 'RoomUpdate',
        roomId: args.roomId,
    })

    return {
        ok: true,
        changed: true,
        beatAnchorTime,
    }
}
