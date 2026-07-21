import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import type { EphemeraPositionGraph } from '../../positionGraph'
import { applyHostRelationalPatch, type ApplyHostRelationalPatchDependencies } from '../applyHostRelationalPatch'
import { applyObjectRelationalChangeWithTransfer } from './applyObjectRelationalChangeWithTransfer'
import { buildObjectRelationalFact } from './buildObjectRelationalFact'
import { planHostRelationalPatch } from './planHostRelationalPatch'
import { streamObjectRelationalFact } from './streamObjectRelationalFact'
import type { RelationalApplyResult, RelationalIngressArgs } from './types'

export type ApplyObjectRelationalChangeDependencies = {
    messageBus: MessageBus
    streamEvent: StreamEventFunction<PositionsPublishedPayload>
    kernelPersist?: ApplyHostRelationalPatchDependencies
}

/**
 * Renamed from `seedRoomGraphMemos` (BD-15/16 slice 4) --- the old version `continue`d
 * past `internalCache.Positions.set(graph)` for any non-room graph, so a Character-hosted
 * relation would persist correctly but leave that character's cached `positionGraph` stale
 * for the rest of the warm container's lifetime. Matches `applyObjectSetTransfer.ts`'s
 * already-correct `seedGraphMemos`: `Positions.set` is unconditional; only the room-specific
 * cache invalidations are gated.
 */
const seedGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (isEphemeraRoomId(graph.hostId)) {
            internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
            internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        }
        internalCache.Positions.set(graph)
    }
}

export const applyObjectRelationalChange = async (
    args: RelationalIngressArgs,
    deps: ApplyObjectRelationalChangeDependencies
): Promise<RelationalApplyResult> => {
    if (args.transferFromHostId !== undefined) {
        return applyObjectRelationalChangeWithTransfer(
            { ...args, transferFromHostId: args.transferFromHostId },
            { messageBus: deps.messageBus, streamEvent: deps.streamEvent }
        )
    }

    const patch = planHostRelationalPatch(args)

    const kernelResult = await applyHostRelationalPatch(
        { patches: [patch] },
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

    if (!kernelResult.persisted || !kernelResult.changed) {
        return { ok: true, changed: false }
    }

    const beatAnchorTime = getCurrentTimestamp()
    const fact = buildObjectRelationalFact({
        subjectId: args.subjectId,
        targetId: args.targetId,
        hostId: args.hostId,
        relationKind: args.relationKind,
        relationLabel: args.relationLabel,
        operation: args.operation,
        beatAnchorTime,
    })

    // Cache write-through + AffordanceRoomDeliverable invalidation must land before the
    // "Object Related" fact is streamed below --- see applyObjectSetTransfer.ts's matching
    // comment: messageBus.publish is fire-and-forget, so a stream event's downstream
    // affordance-refresh chain can otherwise race ahead of this update and memoize a
    // pre-mutation read.
    seedGraphMemos(kernelResult.postApplyGraphs)
    await streamObjectRelationalFact(fact, { streamEvent: deps.streamEvent })

    if (isEphemeraRoomId(args.hostId)) {
        deps.messageBus.publish({
            type: 'RoomUpdate',
            roomId: args.hostId,
        })
    }

    return {
        ok: true,
        changed: true,
        beatAnchorTime,
    }
}
