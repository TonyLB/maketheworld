import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { computeCarryClosure } from '../../../../positions/ludicGraph/expandValidate/interactionUnderTransfer'
import type { EphemeraLudicGraph } from '../../../../positions/ludicGraph'
import type { ExpansionEnvironment, GroupId } from './executorTypes'

let groupIdCounter = 0

/** Fresh per executor run --- the shared environment for one worklist's lifetime. */
export const createExpansionEnvironment = (
    getGraph: (hostId: EphemeraMembershipHostId) => EphemeraLudicGraph | undefined,
    getCurrentHost: (id: EphemeraObjectId) => EphemeraMembershipHostId | undefined
): ExpansionEnvironment => ({
    settledGroups: new Map(),
    groupIdByObject: new Map(),
    getGraph,
    getCurrentHost,
})

const mintGroupId = (): GroupId => `group-${(groupIdCounter += 1)}`

/**
 * Fix 2: operand-expands a carry-closure-shaped instruction (`transferMembership`,
 * `isolatedFromRelations`) by reusing an already-settled group if `startId` is
 * already a member of one --- looked up via `groupIdByObject`, not by matching
 * the original starting id, since a paired instruction (or a later repair)
 * commonly starts its own closure computation from a *different* object that
 * turns out to already belong to the same settled set. Computes fresh (and
 * indexes every member) only on a genuine miss. This is what lets a
 * `transferMembership`/`isolatedFromRelations` pair (or `sameHost`'s inserted
 * repair transfer) share one computation instead of recomputing --- the direct
 * kill for BD-28's duplication.
 */
export const lookupOrComputeClosure = (
    env: ExpansionEnvironment,
    startId: EphemeraObjectId,
    graph: EphemeraLudicGraph
): EphemeraLudicGraph => {
    const existingGroupId = env.groupIdByObject.get(startId)
    if (existingGroupId !== undefined) {
        const existingGroup = env.settledGroups.get(existingGroupId)
        if (existingGroup !== undefined) {
            return existingGroup
        }
    }

    const closure = computeCarryClosure(startId, graph)
    const groupId = mintGroupId()
    env.settledGroups.set(groupId, closure)
    for (const memberId of closure.objectIds) {
        env.groupIdByObject.set(memberId, groupId)
    }
    return closure
}
