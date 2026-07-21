import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { buildObjectMovedFact } from '../../membership/buildObjectMovedFact'
import { streamObjectMembershipFact } from '../../membership/streamObjectMembershipFact'
import type { EphemeraPositionGraph } from '../../positionGraph'
import { planObjectClearFromAllHosts } from '../adapters/planObjectClearFromAllHosts'
import { applyHostEffects, type ApplyHostEffectsDependencies } from '../applyHostEffects'
import type { ClearMembershipApplyResult, ObjectClearMembershipApplyArgs } from './types'

export type ApplyObjectClearMembershipDependencies = {
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

const roomIdsFromDiffFroms = (froms: EphemeraMembershipHostId[]): EphemeraRoomId[] =>
    froms.filter((id): id is EphemeraRoomId => isEphemeraRoomId(id))

/**
 * Remove an object from all membership hosts (rooms and character inventory), then clear adjacency.
 */
export const applyObjectClearMembership = async (
    args: ObjectClearMembershipApplyArgs,
    deps: ApplyObjectClearMembershipDependencies
): Promise<ClearMembershipApplyResult> => {
    const getMembershipContainers = deps.getMembershipContainers ?? defaultGetMembershipContainers

    const priorContainers = await getMembershipContainers(args.objectId)
    const plan = planObjectClearFromAllHosts({
        objectId: args.objectId,
        priorContainers,
    })

    const diff = plan.projection

    if (!diff.changed) {
        return { ok: true, ...diff }
    }

    const kernelResult = await applyHostEffects(
        { hostEffects: plan.hostEffects },
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
        return { ok: true, ...diff }
    }

    const beatAnchorTime = getCurrentTimestamp()

    // Cache write-through + AffordanceRoomDeliverable invalidation must land before the
    // "Object Moved" fact is streamed below --- see applyObjectSetTransfer.ts's matching
    // comment: messageBus.publish is fire-and-forget, so a stream event's downstream
    // affordance-refresh chain can otherwise race ahead of this update and memoize a
    // pre-mutation read.
    seedRoomGraphMemos(kernelResult.postApplyGraphs)
    seedCharacterGraphMemos(kernelResult.postApplyGraphs)
    internalCache.Positions.setMembershipContainers({
        componentId: args.objectId,
        containers: [],
    })

    const fact = buildObjectMovedFact({
        objectId: args.objectId,
        diff,
        beatAnchorTime,
    })
    if (fact) {
        await streamObjectMembershipFact(fact, { streamEvent: deps.streamEvent })
    }

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
