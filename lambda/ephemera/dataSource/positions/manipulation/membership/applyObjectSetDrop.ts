import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import type { EphemeraPositionGraph } from '../../positionGraph'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../applyHostEffects'
import { planObjectDropTransfer } from '../adapters/planObjectDropTransfer'
import type { HostEffect } from '../types'
import type { DropSetApplyResult, ObjectSetDropApplyArgs, ObjectSetMembershipDiff } from './types'

export type ApplyObjectSetDropDependencies = {
    messageBus: MessageBus;
    streamEvent: StreamEventFunction<PositionsPublishedPayload>;
    getMembershipContainers?: (objectId: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>;
    kernelPersist?: ApplyHostEffectsDependencies;
}

const defaultGetMembershipContainers = async (
    objectId: EphemeraObjectId
): Promise<EphemeraMembershipHostId[]> =>
    internalCache.Positions.getMembershipContainers(objectId)

const seedRoomGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (!isEphemeraRoomId(graph.hostId)) {
            continue
        }
        internalCache.ComponentEphemeraMeta.invalidate(graph.hostId)
        internalCache.AffordanceRoomDeliverable.invalidate(graph.hostId)
        internalCache.Positions.set(graph)
    }
}

const seedCharacterGraphMemos = (postApplyGraphs: EphemeraPositionGraph[]): void => {
    for (const graph of postApplyGraphs) {
        if (!isEphemeraCharacterId(graph.hostId)) {
            continue
        }
        internalCache.Positions.set(graph)
    }
}

/**
 * Object-*set*-aware drop apply (Pipeline A -> B migration slice 1, BD-13
 * slice 3 kernel half) --- mirrors `applyObjectSetTakeHold.ts` for the
 * character -> room direction. Additive: no production caller yet.
 */
export const applyObjectSetDrop = async (
    args: ObjectSetDropApplyArgs,
    deps: ApplyObjectSetDropDependencies
): Promise<DropSetApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const plans = await Promise.all(
        args.objectIds.map(async (objectId) => {
            const priorContainers = await getMembershipContainers(objectId)
            const plan = planObjectDropTransfer({
                objectId,
                roomId: args.roomId,
                characterId: args.characterId,
                priorContainers,
            })
            return { objectId, plan }
        })
    )

    const diffs: ObjectSetMembershipDiff[] = plans.map(({ objectId, plan }) => ({
        objectId,
        froms: plan.projection.froms,
        to: plan.projection.to,
        changed: plan.projection.changed,
    }))

    const hostEffects: HostEffect[] = plans.flatMap(({ plan }) => plan.hostEffects)

    if (hostEffects.length === 0) {
        return { ok: true, diffs }
    }

    const kernelResult = await applyHostEffects(
        { hostEffects, edgeCarries: args.carriedEdges ?? [] },
        deps.kernelPersist
    )

    if (!kernelResult.ok) {
        console.error(`[mtw.ephemera.positions] applyHostEffects failed: ${kernelResult.errorMessage}`)
        return {
            ok: false,
            errorCode: kernelResult.errorCode,
            errorMessage: kernelResult.errorMessage,
        }
    }

    if (!kernelResult.persisted) {
        return { ok: true, diffs }
    }

    const beatAnchorTime = getCurrentTimestamp()

    for (const diff of diffs) {
        const fact = buildObjectMovedFact({
            objectId: diff.objectId,
            diff,
            beatAnchorTime,
        })
        if (fact) {
            await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
        }
    }

    seedRoomGraphMemos(kernelResult.postApplyGraphs)
    seedCharacterGraphMemos(kernelResult.postApplyGraphs)

    for (const objectId of args.objectIds) {
        internalCache.Positions.setMembershipContainers({
            componentId: objectId,
            containers: [args.roomId],
        })
    }

    deps.messageBus.publish({
        type: 'RoomUpdate',
        roomId: args.roomId,
    })

    return {
        ok: true,
        diffs,
        beatAnchorTime,
    }
}
