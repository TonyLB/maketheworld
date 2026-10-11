import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from './index'

type GetGraph = (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>

/**
 * The parent a presence binding is present at. `host` always names the parent's shard. `presence`
 * names the parent's binding that covers this one, and is set only when that is unambiguous (see
 * `resolveParentPresence`); a walker given no `presence` falls back to host-grain fan-out. A later
 * slice stores the pointer and makes `presence` required.
 */
export type ParentBinding = {
    host: EphemeraMembershipHostId
    presence?: EphemeraPresenceNodeId
}

export type OwnedParentBinding = {
    binding: EphemeraLudicGraphStructureNode
    parent: ParentBinding
}

/**
 * Which of `parentHostId`'s own bindings covers `owner`'s `binding`, if the data says so
 * unambiguously: a binding whose cover lists it as an entry, else the parent's only binding when
 * the parent is not a room. Never guesses: a room's only binding is its Area binding (a
 * carve-out, not the parent of what the room holds), no binding leaves nothing to name, and
 * several bindings cannot be told apart.
 */
const resolveParentPresence = async (
    owner: EphemeraMembershipHostId,
    binding: EphemeraLudicGraphStructureNode,
    parentHostId: EphemeraMembershipHostId,
    getGraph: GetGraph
): Promise<EphemeraPresenceNodeId | undefined> => {
    const parentBindings = (await getGraph(parentHostId)).presenceNodes
    const listing = parentBindings.find(({ cover }) => (
        cover.members.some((entry) => !isEphemeraPresenceCoverRemainder(entry) && entry.host === owner && entry.presence === binding.universalKey)
    ))
    if (listing) {
        return listing.universalKey
    }
    if (!isEphemeraRoomId(parentHostId) && parentBindings.length === 1) {
        return parentBindings[0].universalKey
    }
    return undefined
}

/**
 * Every presence binding on `ownerHostId`'s own graph (a binding is minted onto the mover's own
 * graph), each with the parent it names: the one place a walker reads upward edges. Walkers read
 * `parent.host` and fan out over it; membership is a DAG, so one host can have several parents.
 *
 * `resolvePresence` additionally reads each parent's graph to fill `parent.presence`. It is off by
 * default because host-grain walkers fetch those graphs anyway on their next level.
 */
export const parentBindingsOf = async (
    ownerHostId: EphemeraMembershipHostId,
    getGraph: GetGraph,
    { resolvePresence = false }: { resolvePresence?: boolean } = {}
): Promise<OwnedParentBinding[]> => {
    const { presenceNodes } = await getGraph(ownerHostId)
    return Promise.all(presenceNodes.map(async (binding) => {
        const host = binding.fromHostId
        if (!resolvePresence) {
            return { binding, parent: { host } }
        }
        const presence = await resolveParentPresence(ownerHostId, binding, host, getGraph)
        return { binding, parent: presence ? { host, presence } : { host } }
    }))
}

/** One binding of `ownerHostId`'s, located by id on the owner's own graph. */
export const parentBinding = async (
    ownerHostId: EphemeraMembershipHostId,
    presenceId: EphemeraPresenceNodeId,
    getGraph: GetGraph,
    options: { resolvePresence?: boolean } = {}
): Promise<ParentBinding> => {
    const found = (await parentBindingsOf(ownerHostId, getGraph, options))
        .find(({ binding }) => binding.universalKey === presenceId)
    if (!found) {
        throw new Error(`parentBinding: ${presenceId} not found on ${ownerHostId}'s own graph`)
    }
    return found.parent
}
