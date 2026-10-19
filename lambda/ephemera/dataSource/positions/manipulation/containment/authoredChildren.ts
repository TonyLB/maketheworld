import { isEphemeraAreaId, isEphemeraFeatureId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraFeatureId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'

type NodeLike = { isPresence?: boolean; ref?: number; universalKey?: string }

/**
 * The positive-ref, non-presence nodes of one `Component Updated` diff. `ref < 0` marks a node the
 * asset removed (the diff inverts it), and presence nodes are the parent's own bindings, not
 * children. Shared by the cache-time ingress and the heal so both read "added" the same way.
 */
export const addedNodesOf = <T extends NodeLike>(nodes: readonly T[]): T[] =>
    nodes.filter((node) => !node.isPresence && (node.ref ?? 1) > 0)

/**
 * The Room and Feature children a set of per-asset `ludicGraph.nodes` lists declare. Objects are
 * left out because their placement is meant to change (the authored one is only an initial state).
 */
export const authoredChildIdsFromNodeLists = (nodeLists: readonly (readonly NodeLike[])[]): (EphemeraRoomId | EphemeraFeatureId)[] => [
    ...new Set(nodeLists.flatMap((nodes) => addedNodesOf(nodes).flatMap((node) => (
        typeof node.universalKey === 'string' && (isEphemeraRoomId(node.universalKey) || isEphemeraFeatureId(node.universalKey))
            ? [node.universalKey as EphemeraRoomId | EphemeraFeatureId]
            : []
    ))))
].sort()

/**
 * The nestings a parent's authored assets declare: the setpoint `healContainmentPopulation` repairs
 * toward. `Component Updated` carries each asset's component as a diff, so the setpoint is the union
 * of added nodes across every asset in `Meta::<Tag>.cached`. The diagnostics sweep reads the same
 * list (`lambda/diagnostics/containmentPopulationDriftSweep/authoredNestings.ts`); keep the two
 * definitions of "authored" in step.
 */
export const authoredChildrenOf = async (parentId: EphemeraMembershipHostId): Promise<(EphemeraRoomId | EphemeraFeatureId)[]> => {
    if (!isEphemeraRoomId(parentId) && !isEphemeraAreaId(parentId) && !isEphemeraFeatureId(parentId)) {
        return []
    }
    const assetIds = (await internalCache.RoomAssets.get(parentId)) ?? []
    if (assetIds.length === 0) {
        return []
    }
    const entries = await internalCache.ComponentData.getAcrossAssets(parentId as any, assetIds)
    return authoredChildIdsFromNodeLists(Object.values(entries).map((entry) => (
        (entry.component as { ludicGraph?: { nodes?: { payload?: NodeLike[] } } }).ludicGraph?.nodes?.payload ?? []
    )))
}
