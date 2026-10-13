import { isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover, EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelJoinPresenceBindingsStep } from './kernelStep'

const entriesOf = (cover: EphemeraPresenceCover): EphemeraPresenceCoverEntry[] => (
    cover.members.filter((member): member is EphemeraPresenceCoverEntry => !isEphemeraPresenceCoverRemainder(member))
)
const hasRemainder = (cover: EphemeraPresenceCover): boolean => cover.members.some(isEphemeraPresenceCoverRemainder)

/** Whether two covers name the same entries (host to binding) and agree on holding a `Remainder`. */
const sameCover = (a: EphemeraPresenceCover, b: EphemeraPresenceCover): boolean => {
    const entriesA = entriesOf(a)
    const entriesB = new Map(entriesOf(b).map((entry) => [entry.host, entry.presence]))
    return (
        hasRemainder(a) === hasRemainder(b)
        && entriesA.length === entriesB.size
        && entriesA.every((entry) => entriesB.get(entry.host) === entry.presence)
    )
}

/**
 * A join's write (`MutationKernelJoinPresenceBindingsStep`): the absorbed binding's entries move onto
 * the survivor, the absorbed node is removed, and each child it listed has its own binding re-pointed
 * from the absorbed binding to the survivor. The `Remainder` merges to one, held by the survivor if
 * either binding held it. Writes the whole's graph and the children's, so it returns the whole map.
 * Collisions among the children are not decided here: a child that held a binding under each joined
 * binding is left holding two under the survivor, for the end-of-run validator to throw on (PM-2).
 * A `reasonCode` is the `stale` reason, because the producer built the step against a snapshot that
 * may since have changed.
 */
export const joinPresenceBindings = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelJoinPresenceBindingsStep
): { graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph> } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const survivor = graph.presenceNodes.find(({ universalKey }) => universalKey === step.survivor)
    const absorbed = graph.presenceNodes.find(({ universalKey }) => universalKey === step.absorbed)
    if (!survivor || !absorbed || step.survivor === step.absorbed) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    if (
        survivor.fromHostPresence?.host !== absorbed.fromHostPresence?.host
        || survivor.fromHostPresence?.presence !== absorbed.fromHostPresence?.presence
    ) {
        return { reasonCode: 'joinParentsDiffer' }
    }
    if (!sameCover(step.absorbedCover, absorbed.cover)) {
        return { reasonCode: 'joinCoverChanged' }
    }

    const absorbedEntries = entriesOf(absorbed.cover)

    const mergedMembers: EphemeraPresenceCover['members'] = [
        ...entriesOf(survivor.cover).map((entry) => ({ ...entry })),
        ...absorbedEntries.map((entry) => ({ ...entry })),
        ...(hasRemainder(survivor.cover) || hasRemainder(absorbed.cover) ? [{ tag: 'Remainder' as const }] : []),
    ]

    const next = new Map(graphs)
    next.set(
        step.hostId,
        graph
            .replacePresenceNode({ ...survivor, cover: { members: mergedMembers } })
            .removePresenceNode(step.absorbed)
    )

    for (const entry of absorbedEntries) {
        const childHost = entry.host as EphemeraMembershipHostId
        const childGraph = next.get(childHost)
        if (!childGraph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        const child = childGraph.presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
        if (!child) {
            return { reasonCode: 'presenceBindingMissing' }
        }
        if (child.fromHostPresence?.host !== step.hostId || child.fromHostPresence.presence !== step.absorbed) {
            return { reasonCode: 'presenceBindingMoved' }
        }
        next.set(childHost, childGraph.replacePresenceNode({
            ...child,
            fromHostPresence: { host: step.hostId, presence: step.survivor },
        }))
    }
    return { graphs: next }
}
