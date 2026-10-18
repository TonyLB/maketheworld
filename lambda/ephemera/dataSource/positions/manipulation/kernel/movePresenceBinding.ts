import { BASE_PRESENCE_ID, UNPLACED_PRESENCE_ID, isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover, EphemeraPresenceCoverEntry, EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { isBystanderMove } from './bystander'
import type { MutationKernelMovePresenceBindingStep } from './kernelStep'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>
type Binding = EphemeraLudicGraphStructureNode

const entriesOf = (cover: EphemeraPresenceCover): EphemeraPresenceCoverEntry[] => (
    cover.members.filter((member): member is EphemeraPresenceCoverEntry => !isEphemeraPresenceCoverRemainder(member))
)
const hasRemainder = (cover: EphemeraPresenceCover): boolean => cover.members.some(isEphemeraPresenceCoverRemainder)
const sameEntry = (a: EphemeraPresenceCoverEntry, b: EphemeraPresenceCoverEntry): boolean => a.host === b.host && a.presence === b.presence
const hasEntry = (cover: EphemeraPresenceCover, entry: EphemeraPresenceCoverEntry): boolean => entriesOf(cover).some((existing) => sameEntry(existing, entry))
const pointsAt = (binding: Binding, parent: ParentBinding): boolean => (
    binding.fromHostPresence?.host === parent.host && binding.fromHostPresence.presence === parent.presence
)

/** Plain copies throughout: the cover is retained in the graph past the reducer's return. */
export const withEntries = (cover: EphemeraPresenceCover, add: readonly EphemeraPresenceCoverEntry[]): EphemeraPresenceCover => ({
    members: [
        ...cover.members.map((member) => ({ ...member })),
        ...add.filter((entry) => !hasEntry(cover, entry)).map((entry) => ({ ...entry })),
    ],
})
export const withoutEntries = (cover: EphemeraPresenceCover, remove: readonly EphemeraPresenceCoverEntry[]): EphemeraPresenceCover => ({
    members: cover.members.filter((member) => isEphemeraPresenceCoverRemainder(member) || !remove.some((entry) => sameEntry(entry, member))).map((member) => ({ ...member })),
})

/** Whether two covers name the same entries and agree on holding a `Remainder`. */
const sameCover = (a: EphemeraPresenceCover, b: EphemeraPresenceCover): boolean => {
    const entriesA = entriesOf(a)
    const entriesB = entriesOf(b)
    return hasRemainder(a) === hasRemainder(b) && entriesA.length === entriesB.length && entriesA.every((entry) => hasEntry(b, entry))
}

/**
 * A move's write (`MutationKernelMovePresenceBindingStep`, monotoneCovers MC-3). Writes the whole's
 * graph, the children's (their pointers re-point) and the parents' (their covers are the index), so
 * it returns the whole map. A `reasonCode` is the `stale` reason: the producer built the step
 * against a snapshot that may since have changed.
 *
 * A child left holding two bindings under the receiving binding has them merged by this same move,
 * one level down; it ends because the host graph is a DAG.
 *
 * How the parenting of Base changes when part of its cover moves is deliberately the generic answer
 * (a part moved out of a hostless Base mints a binding at the destination and leaves Base hostless);
 * stating it explicitly is owed to the parent-sets work (PR-25).
 */
export const movePresenceBinding = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelMovePresenceBindingStep
): { graphs: Graphs } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const node = graph.presenceNodes.find(({ universalKey }) => universalKey === step.presence)
    if (!node) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    if (step.from === null ? !!node.fromHostPresence : !pointsAt(node, step.from)) {
        return { reasonCode: 'presenceBindingMoved' }
    }
    const wholeMove = step.subCover === undefined
    if (wholeMove && step.cover && !sameCover(step.cover, node.cover)) {
        return { reasonCode: 'moveCoverChanged' }
    }
    const moved: EphemeraPresenceCoverEntry[] = wholeMove ? entriesOf(node.cover) : [...step.subCover!]
    if (!wholeMove) {
        const seen: EphemeraPresenceCoverEntry[] = []
        for (const entry of moved) {
            if (!hasEntry(node.cover, entry)) {
                return { reasonCode: 'moveEntryNotCovered' }
            }
            if (seen.some((other) => other.host === entry.host)) {
                return { reasonCode: 'moveNotDisjoint' }
            }
            seen.push(entry)
        }
    }

    // The destination parent's binding must exist, except for a bystander, whose room is not in the footprint.
    const bystanderTo = step.to !== null && isBystanderMove(step.hostId, step.to.host)
    if (step.to !== null && !bystanderTo) {
        const destination = graphs.get(step.to.host)
        if (!destination) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        if (!destination.presenceNodes.some(({ universalKey }) => universalKey === step.to!.presence)) {
            return { reasonCode: 'destinationBindingMissing' }
        }
    }

    // Resolve the binding that will hold the moved entries (`target`), and what else merges into it.
    let target: Binding
    let mintedTarget = false
    const absorbed: Binding[] = []
    if (step.to !== null) {
        const existing = graph.presenceNodes.find((candidate) => candidate.universalKey !== node.universalKey && pointsAt(candidate, step.to!))
        if (existing) {
            target = existing
        }
        else if (wholeMove) {
            target = { ...node, fromHostPresence: { host: step.to.host, presence: step.to.presence } }
        }
        else {
            if (!step.mintedPresence) {
                return { reasonCode: 'moveMintMissing' }
            }
            if (graph.presenceNodes.some(({ universalKey }) => universalKey === step.mintedPresence)) {
                return { reasonCode: 'moveIdCollision' }
            }
            target = {
                tag: 'Presence',
                universalKey: step.mintedPresence,
                fromHostPresence: { host: step.to.host, presence: step.to.presence },
                cover: { members: [] },
            }
            mintedTarget = true
        }
    }
    else {
        const base = graph.presenceNodes.find(({ universalKey }) => universalKey === BASE_PRESENCE_ID)
        const unplaced = graph.presenceNodes.find(({ universalKey }) => universalKey === UNPLACED_PRESENCE_ID)
        if (!base) {
            // Unmigrated data (monotoneCovers Slice 5): no Base to land in, so the pointer is stripped in
            // place (or the binding folds into the whole's hostless one), as a release did.
            if (!wholeMove) {
                return { reasonCode: 'baseMissing' }
            }
            // A whole that already holds a hostless binding folds the departing one into it, so a scrub of
            // several bindings still ends with one binding with no parent.
            const otherHostless = graph.presenceNodes.find((candidate) => candidate.universalKey !== node.universalKey && !candidate.fromHostPresence)
            if (otherHostless) {
                target = otherHostless
            }
            else {
                const { fromHostPresence: _departed, ...hostless } = node
                target = hostless
            }
        }
        else if (node.universalKey === BASE_PRESENCE_ID) {
            if (!wholeMove) {
                // Part of a hostless Base moved to no parent is where it already is.
                return { graphs: new Map(graphs) }
            }
            const { fromHostPresence: _departed, ...hostless } = node
            target = hostless
            if (unplaced) {
                absorbed.push(unplaced)
            }
        }
        else if (!base.fromHostPresence) {
            target = base
        }
        else if (unplaced) {
            target = unplaced
        }
        else {
            target = { tag: 'Presence', universalKey: UNPLACED_PRESENCE_ID, cover: { members: [] } }
            mintedTarget = true
        }
    }

    const targetIsNode = target.universalKey === node.universalKey
    const absorbedEntries = absorbed.flatMap((binding) => entriesOf(binding.cover))
    const arrivals = [...moved.map((entry) => ({ entry, from: node.universalKey })), ...absorbedEntries.map((entry) => ({ entry, from: UNPLACED_PRESENCE_ID }))]

    // The whole's own graph: the target takes the entries, the source gives them up (or goes).
    let nextHost = graph
    if (targetIsNode) {
        nextHost = nextHost.replacePresenceNode({
            ...target,
            cover: withEntries(target.cover, absorbedEntries),
        })
    }
    else {
        const targetCover = withEntries(target.cover, arrivals.map(({ entry }) => entry))
        const carriedRemainder = wholeMove && hasRemainder(node.cover) && !hasRemainder(targetCover)
        const nextTarget = {
            ...target,
            cover: carriedRemainder ? { members: [...targetCover.members, { tag: 'Remainder' as const }] } : targetCover,
        }
        nextHost = mintedTarget ? nextHost.addPresenceNode(nextTarget) : nextHost.replacePresenceNode(nextTarget)
        nextHost = wholeMove
            ? nextHost.removePresenceNode(node.universalKey)
            : nextHost.replacePresenceNode({ ...node, cover: withoutEntries(node.cover, moved) })
    }
    for (const binding of absorbed) {
        nextHost = nextHost.removePresenceNode(binding.universalKey)
    }
    const next: Graphs = new Map(graphs)
    next.set(step.hostId, nextHost)

    // Children: each moved entry names a child binding, now covered by the target.
    const collisions: { host: EphemeraMembershipHostId; presence: EphemeraPresenceNodeId }[] = []
    if (!targetIsNode || absorbed.length > 0) {
        for (const { entry, from } of arrivals) {
            if (targetIsNode && from === node.universalKey) {
                continue
            }
            const childHost = entry.host as EphemeraMembershipHostId
            const childGraph = next.get(childHost)
            if (!childGraph) {
                return { reasonCode: 'hostNotInFootprint' }
            }
            const child = childGraph.presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
            if (!child) {
                return { reasonCode: 'presenceBindingMissing' }
            }
            if (!pointsAt(child, { host: step.hostId, presence: from })) {
                return { reasonCode: 'presenceBindingMoved' }
            }
            const repointed = childGraph.replacePresenceNode({
                ...child,
                fromHostPresence: { host: step.hostId, presence: target.universalKey },
            })
            next.set(childHost, repointed)
            if (repointed.presenceNodes.filter((candidate) => pointsAt(candidate, { host: step.hostId, presence: target.universalKey })).length > 1) {
                collisions.push({ host: childHost, presence: entry.presence })
            }
        }
    }

    // The cover index: the entry for this whole's binding leaves its old parent and arrives at its new one.
    const writeParentCover = (parent: ParentBinding, change: (cover: EphemeraPresenceCover) => EphemeraPresenceCover): { reasonCode: string } | undefined => {
        if (isBystanderMove(step.hostId, parent.host)) {
            return undefined
        }
        const parentGraph = next.get(parent.host)
        if (!parentGraph) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        const parentBinding = parentGraph.presenceNodes.find(({ universalKey }) => universalKey === parent.presence)
        if (!parentBinding) {
            // A vanished parent binding has no index to correct; drift owns it.
            return undefined
        }
        next.set(parent.host, parentGraph.replacePresenceNode({ ...parentBinding, cover: change(parentBinding.cover) }))
        return undefined
    }
    // A part move leaves its source binding where it is, so only a whole move changes the source's entry.
    const leaving = wholeMove && (!targetIsNode || node.fromHostPresence?.host !== target.fromHostPresence?.host || node.fromHostPresence?.presence !== target.fromHostPresence?.presence)
    if (node.fromHostPresence && leaving) {
        const failure = writeParentCover(node.fromHostPresence, (cover) => withoutEntries(cover, [{ host: step.hostId as EphemeraPresenceCoverEntry['host'], presence: node.universalKey }]))
        if (failure) {
            return failure
        }
    }
    if (target.fromHostPresence) {
        const failure = writeParentCover(target.fromHostPresence, (cover) => withEntries(cover, [{ host: step.hostId as EphemeraPresenceCoverEntry['host'], presence: target.universalKey }]))
        if (failure) {
            return failure
        }
    }

    // A child that now holds two bindings under the target merges its arrival into the one already there.
    let result: Graphs = next
    const under: ParentBinding = { host: step.hostId, presence: target.universalKey }
    for (const collision of collisions) {
        const merged = movePresenceBinding(result, {
            kind: 'movePresenceBinding',
            hostId: collision.host,
            presence: collision.presence,
            from: under,
            to: under,
        })
        if ('reasonCode' in merged) {
            return merged
        }
        result = merged.graphs
    }
    return { graphs: result }
}
