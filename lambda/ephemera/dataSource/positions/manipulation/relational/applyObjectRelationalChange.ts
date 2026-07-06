import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { EphemeraPositionGraph } from '../../positionGraph'
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

const seedRoomGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (!isEphemeraRoomId(graph.hostId)) {
            continue
        }
        internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
        internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        internalCache.Positions.set({
            componentId: graph.hostId,
            graph: graph.toPlayEnvelope(),
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
