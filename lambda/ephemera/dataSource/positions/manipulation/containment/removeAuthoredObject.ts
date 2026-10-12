import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'

import internalCache from '../../../../internalCache'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { parentOf } from '../../ludicGraph/presenceParent'
import type { PositionsPublishedPayload } from '../../publishedEvents'
import { streamEventFromMessageBus } from '../../publishedEvents'
import { executeMembershipTransfer } from '../membership/executeMembershipTransfer'

export type RemoveAuthoredObjectDependencies = {
    messageBus: MessageBus
    /** Test seam only --- production callers always derive this from `messageBus`. */
    streamEvent?: StreamEventFunction<PositionsPublishedPayload>
    /** Test seam only. */
    getMembershipContainers?: (id: EphemeraObjectId) => Promise<EphemeraMembershipHostId[]>
    /** Test seam only. */
    getLudicGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

/**
 * The host each content of the removed Object lands in: the parent host of the Object binding
 * the content's own binding points at, so a multi-host Object empties each binding into its own
 * host. A content whose pointer names no Object binding (a host-only pointer) falls back to the
 * Object's first host. Pure; `contentGraphs` are the contents' own graphs.
 */
export const contentDestinations = (
    objectId: EphemeraObjectId,
    objectGraph: EphemeraLudicGraph,
    contentGraphs: readonly EphemeraLudicGraph[],
    objectHosts: readonly EphemeraMembershipHostId[]
): Map<EphemeraMembershipHostId, EphemeraMembershipHostId> => {
    const hostByObjectBinding = new Map(
        objectGraph.presenceNodes.flatMap((binding) => {
            const parent = parentOf(binding)
            return parent ? [[binding.universalKey, parent.host] as const] : []
        })
    )
    return new Map(
        contentGraphs.flatMap((graph) => {
            const contentId = graph.hostId
            const pointer = graph.presenceNodes
                .map(parentOf)
                .find((parent) => parent?.host === objectId)
            const destination = (pointer?.presence ? hostByObjectBinding.get(pointer.presence) : undefined) ?? objectHosts[0]
            return destination ? [[contentId, destination] as const] : []
        })
    )
}

/**
 * Cache-time removal of a de-authored Object (`Component Removed`): its contents move to its host
 * first (`positions/AGENT.contract.md`, `Component Removed` --- deleting them with it would destroy player-placed things because of an author's
 * edit), then the Object leaves every live host, wherever that is (a room, a character's hands,
 * another Object). Both halves are `executeMembershipTransfer`, the existing object-lifecycle
 * route, so edge dissolution and the binding clear are the ones every other destroy uses. An
 * Object with no live host is a no-op, which also makes a redelivered event safe: a failure after
 * the contents moved leaves the Object live, and the rerun finds no contents and finishes the job.
 */
export const removeAuthoredObject = async (
    objectId: EphemeraObjectId,
    deps: RemoveAuthoredObjectDependencies
): Promise<void> => {
    const getMembershipContainers = deps.getMembershipContainers ?? ((id) => internalCache.Positions.getMembershipContainers(id))
    const getLudicGraph = deps.getLudicGraph ?? ((hostId) => internalCache.Positions.getLudicGraph(hostId))
    const streamEvent = deps.streamEvent ?? streamEventFromMessageBus(deps.messageBus)

    const hosts = await getMembershipContainers(objectId)
    if (hosts.length === 0) {
        return
    }

    const objectGraph = await getLudicGraph(objectId)
    const contentIds = [...objectGraph.nodeIds].filter((id): id is EphemeraObjectId =>
        id !== objectId && isEphemeraObjectId(id)
    )
    const contentGraphs = await Promise.all(contentIds.map((id) => getLudicGraph(id)))
    const destinations = contentDestinations(objectId, objectGraph, contentGraphs, hosts)

    for (const contentId of contentIds) {
        const target = destinations.get(contentId)
        if (!target) {
            console.error(`[mtw.ephemera.positions] removeAuthoredObject: no host to receive ${contentId} from ${objectId}; leaving it in place`)
            continue
        }
        const moved = await executeMembershipTransfer({
            entityId: contentId,
            target,
            messageBus: deps.messageBus,
            streamEvent,
            getMembershipContainers: async () => [objectId],
        })
        if (!moved.ok) {
            console.error(`[mtw.ephemera.positions] removeAuthoredObject: moving ${contentId} out of ${objectId} failed: ${moved.errorMessage}`)
            return
        }
    }

    const removed = await executeMembershipTransfer({
        entityId: objectId,
        target: null,
        messageBus: deps.messageBus,
        streamEvent,
    })
    if (!removed.ok) {
        console.error(`[mtw.ephemera.positions] removeAuthoredObject failed for ${objectId}: ${removed.errorMessage}`)
    }
}
