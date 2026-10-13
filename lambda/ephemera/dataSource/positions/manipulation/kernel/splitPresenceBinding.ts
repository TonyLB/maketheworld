import { isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover, EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelSplitPresenceBindingStep } from './kernelStep'

const entriesOf = (cover: EphemeraPresenceCover): EphemeraPresenceCoverEntry[] => (
    cover.members.filter((member): member is EphemeraPresenceCoverEntry => !isEphemeraPresenceCoverRemainder(member))
)
const hasRemainder = (cover: EphemeraPresenceCover): boolean => cover.members.some(isEphemeraPresenceCoverRemainder)

/** Plain copy: the step's cover is retained in the graph past the reducer's return. */
const plainCover = (cover: EphemeraPresenceCover): EphemeraPresenceCover => ({ members: cover.members.map((member) => ({ ...member })) })

/**
 * A split's write (`MutationKernelSplitPresenceBindingStep`): the original binding becomes its entry
 * in `splitInto`, every other entry is added under the original's parent, and each child listed in
 * one of those other bindings has its own binding re-pointed from the original to its new parent
 * binding. Writes the whole's graph and the children's, so it returns the whole map. A
 * `reasonCode` is the `stale` reason; every scope violation (overlap, an uncovered or dropped
 * entry, a moved `Remainder`, an id clash) is refused here rather than thrown, because the producer
 * built the step against a snapshot that may since have changed.
 */
export const splitPresenceBinding = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelSplitPresenceBindingStep
): { graphs: Map<EphemeraMembershipHostId, EphemeraLudicGraph> } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === step.presence)
    if (!node) {
        return { reasonCode: 'presenceBindingMissing' }
    }

    const originals = step.splitInto.filter(({ presence }) => presence === step.presence)
    const additions = step.splitInto.filter(({ presence }) => presence !== step.presence)
    const additionIds = additions.map(({ presence }) => presence)
    if (
        originals.length !== 1
        || new Set(additionIds).size !== additionIds.length
        || additionIds.some((id) => graph.presenceNodes.some(({ universalKey }) => universalKey === id))
    ) {
        return { reasonCode: 'splitIdCollision' }
    }
    const [original] = originals

    if (hasRemainder(original.cover) !== hasRemainder(node.cover) || additions.some(({ cover }) => hasRemainder(cover))) {
        return { reasonCode: 'splitRemainderMoved' }
    }

    const covered = new Map(entriesOf(node.cover).map((entry) => [entry.host, entry.presence]))
    const seen = new Set<string>()
    for (const { cover } of step.splitInto) {
        for (const entry of entriesOf(cover)) {
            if (covered.get(entry.host) !== entry.presence) {
                return { reasonCode: 'splitEntryNotCovered' }
            }
            if (seen.has(entry.host)) {
                return { reasonCode: 'splitNotDisjoint' }
            }
            seen.add(entry.host)
        }
    }
    if (seen.size !== covered.size) {
        return { reasonCode: 'splitMemberLost' }
    }

    const next = new Map(graphs)
    let nextGraph = graph.replacePresenceNode({ ...node, cover: plainCover(original.cover) })
    for (const { presence, cover } of additions) {
        nextGraph = nextGraph.addPresenceNode({
            tag: 'Presence',
            universalKey: presence,
            ...(node.fromHostPresence ? { fromHostPresence: { ...node.fromHostPresence } } : {}),
            cover: plainCover(cover),
        })
    }
    next.set(step.hostId, nextGraph)

    for (const { presence: newParent, cover } of additions) {
        for (const entry of entriesOf(cover)) {
            const childHost = entry.host as EphemeraMembershipHostId
            const childGraph = next.get(childHost)
            if (!childGraph) {
                return { reasonCode: 'hostNotInFootprint' }
            }
            const child = childGraph.presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
            if (!child) {
                return { reasonCode: 'presenceBindingMissing' }
            }
            if (child.fromHostPresence?.host !== step.hostId || child.fromHostPresence.presence !== step.presence) {
                return { reasonCode: 'presenceBindingMoved' }
            }
            next.set(childHost, childGraph.replacePresenceNode({
                ...child,
                fromHostPresence: { host: step.hostId, presence: newParent },
            }))
        }
    }
    return { graphs: next }
}
