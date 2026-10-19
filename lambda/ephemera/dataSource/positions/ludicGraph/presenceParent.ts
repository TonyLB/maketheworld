import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'

type GetGraph = (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>

/**
 * The parent a presence binding is present at, read from its stored `fromHostPresence`. `host`
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

/**
 * The binding of the graph's host with no parent pointer, whatever its cover (a
 * whole has at most one). A Room or Area keeps one for good (PR-21(f)); any other whole holds one
 * while unplaced (minted by population as a parent's root, or left by a disconnect/destroy).
 */
export const unpointedBindingOf = (graph: EphemeraLudicGraph): EphemeraLudicGraphStructureNode | undefined => (
    graph.presenceNodes.find((node) => !node.fromHostPresence)
)

/**
 * The binding of `parentGraph`'s host that its children sit under: its `PRESENCE#Base`, which every
 * whole holds, or `undefined` when the host has none yet (population mints it
 * for a Room or Area; a missing one anywhere else is drift the cover-drift sweep reports as `noBase`). Never guesses.
 */
export const childParentBindingIdOf = (parentGraph: EphemeraLudicGraph): EphemeraPresenceNodeId | undefined => (
    parentGraph.presenceNodes.find((node) => node.universalKey === BASE_PRESENCE_ID)?.universalKey
)
