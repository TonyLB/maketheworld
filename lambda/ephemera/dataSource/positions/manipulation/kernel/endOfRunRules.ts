import { UNPLACED_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover, EphemeraPresenceCoverEntry, EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { bindingHasParent, parentsOf } from '../../ludicGraph/presenceParent'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

const sameEntry = (a: EphemeraPresenceCoverEntry, b: EphemeraPresenceCoverEntry): boolean => a.host === b.host && a.presence === b.presence
const hasEntry = (cover: EphemeraPresenceCover, entry: EphemeraPresenceCoverEntry): boolean => cover.members.some((existing) => sameEntry(existing, entry))

/** Plain copies throughout: the cover is retained in the graph past the reducer's return. */
export const withEntries = (cover: EphemeraPresenceCover, add: readonly EphemeraPresenceCoverEntry[]): EphemeraPresenceCover => ({
    members: [
        ...cover.members.map((member) => ({ ...member })),
        ...add.filter((entry) => !hasEntry(cover, entry)).map((entry) => ({ ...entry })),
    ],
})
export const withoutEntries = (cover: EphemeraPresenceCover, remove: readonly EphemeraPresenceCoverEntry[]): EphemeraPresenceCover => ({
    members: cover.members.filter((member) => !remove.some((entry) => sameEntry(entry, member))).map((member) => ({ ...member })),
})

/**
 * F-R1 for the children of a binding that has given up entries (a part left it, or the binding is
 * gone): each entry's child binding drops `parentPresence` from its parent set, and a child left
 * with no parent on `hostId` falls through to `{hostId, Unplaced}`, which is minted if absent. A
 * child that still has another parent on the host (Base, say) gains nothing. `collisions` names
 * the children that now share Unplaced with another binding of their host, for the caller to join.
 */
export const releaseChildren = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    hostId: EphemeraMembershipHostId,
    parentPresence: EphemeraPresenceNodeId,
    entries: readonly EphemeraPresenceCoverEntry[]
): { graphs: Graphs; collisions: EphemeraPresenceCoverEntry[] } | { reasonCode: string } => {
    const next: Graphs = new Map(graphs)
    const fallen: EphemeraPresenceCoverEntry[] = []
    const collisions: EphemeraPresenceCoverEntry[] = []
    const unplaced = { host: hostId, presence: UNPLACED_PRESENCE_ID }
    for (const entry of entries) {
        const childHost = entry.host as EphemeraMembershipHostId
        const childGraph = next.get(childHost)
        if (!childGraph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        const child = childGraph.presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
        if (!child) {
            return { reasonCode: 'presenceBindingMissing' }
        }
        if (!bindingHasParent(child, { host: hostId, presence: parentPresence })) {
            return { reasonCode: 'presenceBindingMoved' }
        }
        const remaining = parentsOf(child).filter((parent) => !(parent.host === hostId && parent.presence === parentPresence))
        const falls = !remaining.some((parent) => parent.host === hostId)
        const replaced = childGraph.replacePresenceNode({ ...child, fromHostPresences: falls ? [...remaining, unplaced] : remaining })
        next.set(childHost, replaced)
        if (falls) {
            fallen.push(entry)
            if (replaced.presenceNodes.filter((candidate) => bindingHasParent(candidate, unplaced)).length > 1) {
                collisions.push(entry)
            }
        }
    }
    if (fallen.length) {
        const graph = next.get(hostId)
        if (!graph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        const existing = graph.presenceNodes.find(({ universalKey }) => universalKey === UNPLACED_PRESENCE_ID)
        next.set(hostId, existing
            ? graph.replacePresenceNode({ ...existing, cover: withEntries(existing.cover, fallen) })
            : graph.addPresenceNode({ tag: 'Presence', universalKey: UNPLACED_PRESENCE_ID, fromHostPresences: [], cover: withEntries({ members: [] }, fallen) } as EphemeraLudicGraphStructureNode)
        )
    }
    return { graphs: next, collisions }
}

/** F-R2: Unplaced exists only while it covers something. Base is never removed. */
export const dropEmptyUnplaced = (graphs: Graphs, hostId: EphemeraMembershipHostId): Graphs => {
    const graph = graphs.get(hostId)
    const unplaced = graph?.presenceNodes.find(({ universalKey }) => universalKey === UNPLACED_PRESENCE_ID)
    if (!graph || !unplaced || unplaced.cover.members.length) {
        return graphs
    }
    return new Map(graphs).set(hostId, graph.removePresenceNode(UNPLACED_PRESENCE_ID))
}
