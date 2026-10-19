import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'

type GetGraph = (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>

/**
 * The parent a presence binding is present at, read from its stored `fromHostPresences`. `host`
 * names the parent's shard; `presence` names the parent binding this one sits under.
 */
export type ParentBinding = {
    host: EphemeraMembershipHostId
    presence: EphemeraPresenceNodeId
}

export type OwnedParentBinding = {
    binding: EphemeraLudicGraphStructureNode
    parent: ParentBinding
}

/** Every parent a binding sits under (PR-25): empty for a hostless binding. The one read of the stored `fromHostPresences`. */
export const parentsOf = (binding: EphemeraLudicGraphStructureNode): ParentBinding[] => (
    binding.fromHostPresences.map(({ host, presence }) => ({ host, presence }))
)

/**
 * The single parent a binding sits under, or `undefined` when hostless. Transitional (parent-sets
 * Slice 1): throws on a binding with more than one parent, so a reader not yet migrated to
 * `parentsOf` fails loudly rather than reading the first parent.
 */
export const parentOf = (binding: EphemeraLudicGraphStructureNode): ParentBinding | undefined => {
    const parents = parentsOf(binding)
    if (parents.length > 1) {
        throw new Error(`parentOf: ${binding.universalKey} has ${parents.length} parents; read them with parentsOf`)
    }
    return parents[0]
}

/** The parent HOST a binding sits under, if it has one. */
export const parentHostOf = (binding: EphemeraLudicGraphStructureNode): EphemeraMembershipHostId | undefined => parentOf(binding)?.host

/**
 * Every presence binding on `ownerHostId`'s own graph that has a parent (a binding is minted onto
 * the mover's own graph), each with the parent it names: the one place a walker reads upward
 * edges. A hostless remainder has no parent and no upward edge, so it is not returned. Membership
 * is a DAG, so one host can have several parents, and a binding with several parents yields one entry per parent.
 */
export const parentBindingsOf = async (
    ownerHostId: EphemeraMembershipHostId,
    getGraph: GetGraph
): Promise<OwnedParentBinding[]> => {
    const { presenceNodes } = await getGraph(ownerHostId)
    return presenceNodes.flatMap((binding) => parentsOf(binding).map((parent) => ({ binding, parent })))
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

/** Whether `binding` names `parent` among its parents. */
export const bindingHasParent = (binding: EphemeraLudicGraphStructureNode, parent: ParentBinding): boolean => (
    parentsOf(binding).some((candidate) => candidate.host === parent.host && candidate.presence === parent.presence)
)

/**
 * The binding of the graph's host with no parent pointer, whatever its cover (a
 * whole has at most one). A Room or Area keeps one for good (PR-21(f)); any other whole holds one
 * while unplaced (minted by population as a parent's root, or left by a disconnect/destroy).
 */
export const unpointedBindingOf = (graph: EphemeraLudicGraph): EphemeraLudicGraphStructureNode | undefined => (
    graph.presenceNodes.find((node) => parentsOf(node).length === 0)
)

/**
 * The binding of `parentGraph`'s host that its children sit under: its `PRESENCE#Base`, which every
 * whole holds, or `undefined` when the host has none yet (population mints it
 * for a Room or Area; a missing one anywhere else is drift the cover-drift sweep reports as `noBase`). Never guesses.
 */
export const childParentBindingIdOf = (parentGraph: EphemeraLudicGraph): EphemeraPresenceNodeId | undefined => (
    parentGraph.presenceNodes.find((node) => node.universalKey === BASE_PRESENCE_ID)?.universalKey
)
