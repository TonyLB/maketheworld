import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'

type GetGraph = (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>

/**
 * The parent a presence binding is present at, read from its stored `fromHostPresence`. `host`
 * names the parent's shard; `presence` names the parent binding this one sits under. `presence`
 * is absent only where the parent holds no binding to name (a Room in an Area, or a move into a
 * host whose binding is unresolved); a walker given no `presence` fans out at host grain.
 */
export type ParentBinding = {
    host: EphemeraMembershipHostId
    presence?: EphemeraPresenceNodeId
}

export type OwnedParentBinding = {
    binding: EphemeraLudicGraphStructureNode
    parent: ParentBinding
}

export const parentOf = (binding: EphemeraLudicGraphStructureNode): ParentBinding | undefined => (
    binding.fromHostPresence
        ? { host: binding.fromHostPresence.host, presence: binding.fromHostPresence.presence }
        : undefined
)

/** The parent HOST a binding sits under, if it has one. */
export const parentHostOf = (binding: EphemeraLudicGraphStructureNode): EphemeraMembershipHostId | undefined => parentOf(binding)?.host

/**
 * Every presence binding on `ownerHostId`'s own graph that has a parent (a binding is minted onto
 * the mover's own graph), each with the parent it names: the one place a walker reads upward
 * edges. A hostless remainder has no parent and no upward edge, so it is not returned. Membership
 * is a DAG, so one host can have several parents.
 */
export const parentBindingsOf = async (
    ownerHostId: EphemeraMembershipHostId,
    getGraph: GetGraph
): Promise<OwnedParentBinding[]> => {
    const { presenceNodes } = await getGraph(ownerHostId)
    return presenceNodes.flatMap((binding) => {
        const parent = parentOf(binding)
        return parent ? [{ binding, parent }] : []
    })
}

/** One binding of `ownerHostId`'s, located by id on the owner's own graph. Hostless: `undefined`. */
export const parentBinding = async (
    ownerHostId: EphemeraMembershipHostId,
    presenceId: EphemeraPresenceNodeId,
    getGraph: GetGraph
): Promise<ParentBinding | undefined> => {
    const { presenceNodes } = await getGraph(ownerHostId)
    const found = presenceNodes.find((binding) => binding.universalKey === presenceId)
    if (!found) {
        throw new Error(`parentBinding: ${presenceId} not found on ${ownerHostId}'s own graph`)
    }
    return parentOf(found)
}

/** A room's one hostless remainder (PR-21(f)): no parent pointer, and a cover that includes the remainder. */
export const hostlessRemainderOf = (graph: EphemeraLudicGraph): EphemeraLudicGraphStructureNode | undefined => (
    graph.presenceNodes.find((node) => (
        !node.fromHostPresence && node.cover.members.some(isEphemeraPresenceCoverRemainder)
    ))
)

/**
 * The binding of `parentGraph`'s host that its children sit under, when the data names one
 * unambiguously: a room's hostless remainder, else the host's only binding. Never guesses --- no
 * binding, or several (the caller must name which), is `undefined`. An Area holds no bindings.
 */
export const childParentBindingIdOf = (parentGraph: EphemeraLudicGraph): EphemeraPresenceNodeId | undefined => {
    if (isEphemeraRoomId(parentGraph.hostId)) {
        return hostlessRemainderOf(parentGraph)?.universalKey
    }
    const { presenceNodes } = parentGraph
    return presenceNodes.length === 1 ? presenceNodes[0].universalKey : undefined
}
