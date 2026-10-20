import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCover, EphemeraPresenceCoverEntry, EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { bindingHasParent, parentOf } from '../../ludicGraph/presenceParent'
import { UNPLACED_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { dropEmptyUnplaced, releaseChildren, withEntries, withoutEntries } from './endOfRunRules'
import { isBystanderMove } from './bystander'
import { collisionsUnder, joinCollisions } from './joinPresenceBindings'
import type { MutationKernelMovePresenceBindingStep } from './kernelStep'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>
type Binding = EphemeraLudicGraphStructureNode

const entriesOf = (cover: EphemeraPresenceCover): EphemeraPresenceCoverEntry[] => cover.members
const sameEntry = (a: EphemeraPresenceCoverEntry, b: EphemeraPresenceCoverEntry): boolean => a.host === b.host && a.presence === b.presence
const hasEntry = (cover: EphemeraPresenceCover, entry: EphemeraPresenceCoverEntry): boolean => entriesOf(cover).some((existing) => sameEntry(existing, entry))
const pointsAt = bindingHasParent

export { withEntries, withoutEntries }

/** Whether two covers name the same entries. */
const sameCover = (a: EphemeraPresenceCover, b: EphemeraPresenceCover): boolean => {
    const entriesA = entriesOf(a)
    const entriesB = entriesOf(b)
    return entriesA.length === entriesB.length && entriesA.every((entry) => hasEntry(b, entry))
}

/** Writes a parent binding's cover (the index of its children). A bystander's parent is a room graph the move never touches. */
const writeParentCover = (
    next: Graphs,
    hostId: EphemeraMembershipHostId,
    parent: ParentBinding,
    change: (cover: EphemeraPresenceCover) => EphemeraPresenceCover
): { reasonCode: string } | undefined => {
    if (isBystanderMove(hostId, parent.host)) {
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

/**
 * A move to no parent (F-R1, F-R2). Nothing lands anywhere by itself: the entries leave the binding,
 * and each child binding drops it as a parent and falls through to Unplaced only if no other parent
 * on the host still covers it (`releaseChildren`). A whole binding other than Base is then left with
 * no parent and is removed; Base is never removed, it just becomes hostless, and Unplaced stays a
 * binding of its own. A binding that is already hostless has nowhere further to go.
 */
const departFromParent = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: MutationKernelMovePresenceBindingStep,
    node: Binding,
    wholeMove: boolean,
    moved: readonly EphemeraPresenceCoverEntry[]
): { graphs: Graphs } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)!
    if (!graph.presenceNodes.some(({ universalKey }) => universalKey === BASE_PRESENCE_ID)) {
        // A whole holds Base from creation on (stored data was migrated); without one the producer's read is stale.
        return { reasonCode: 'baseMissing' }
    }
    const parent = parentOf(node)
    if (!parent) {
        return { graphs: new Map(graphs) }
    }
    const isBase = node.universalKey === BASE_PRESENCE_ID
    let result: Graphs = new Map(graphs).set(step.hostId, wholeMove
        ? (isBase ? graph.replacePresenceNode({ ...node, fromHostPresences: [] }) : graph.removePresenceNode(node.universalKey))
        : graph.replacePresenceNode({ ...node, cover: withoutEntries(node.cover, moved) })
    )
    let collisions: EphemeraPresenceCoverEntry[] = []
    if (!(wholeMove && isBase)) {
        const released = releaseChildren(result, step.hostId, node.universalKey, moved)
        if ('reasonCode' in released) {
            return released
        }
        result = released.graphs
        collisions = released.collisions
    }
    if (wholeMove) {
        const failure = writeParentCover(result, step.hostId, parent, (cover) => withoutEntries(cover, [{ host: step.hostId as EphemeraPresenceCoverEntry['host'], presence: node.universalKey }]))
        if (failure) {
            return failure
        }
    }
    const joined = joinCollisions(result, collisionsUnder(result, { host: step.hostId, presence: UNPLACED_PRESENCE_ID }, collisions))
    if ('reasonCode' in joined) {
        return joined
    }
    result = joined.graphs
    return { graphs: dropEmptyUnplaced(result, step.hostId) }
}

/**
 * A move's write (`MutationKernelMovePresenceBindingStep`). Writes the whole's
 * graph, the children's (their pointers re-point) and the parents' (their covers are the index), so
 * it returns the whole map. A `reasonCode` is the `stale` reason: the producer built the step
 * against a snapshot that may since have changed.
 *
 * A child left holding two bindings under the receiving binding has them merged by this same move,
 * one level down; it ends because the host graph is a DAG.
 *
 * A move to no parent is `departFromParent`, the end-of-run rules F-R1 and F-R2 applied to this move
 * (`endOfRunRules.ts` holds the pieces). How the parenting of Base changes when part of its cover
 * moves is deliberately the generic answer (a part moved out of a hostless Base mints a binding at
 * the destination and leaves Base hostless); stating it explicitly is owed to the parent-sets work.
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
    if (step.from === null ? !!parentOf(node) : !pointsAt(node, step.from)) {
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

    if (step.to === null) {
        return departFromParent(graphs, step, node, wholeMove, moved)
    }
    const to = step.to

    // The destination parent's binding must exist, except for a bystander, whose room is not in the footprint.
    if (!isBystanderMove(step.hostId, to.host)) {
        const destination = graphs.get(to.host)
        if (!destination) {
            return { reasonCode: 'hostNotInFootprint' }
        }
        if (!destination.presenceNodes.some(({ universalKey }) => universalKey === to.presence)) {
            return { reasonCode: 'destinationBindingMissing' }
        }
    }

    // Resolve the binding that will hold the moved entries (`target`).
    let target: Binding
    let mintedTarget = false
    const existing = graph.presenceNodes.find((candidate) => candidate.universalKey !== node.universalKey && pointsAt(candidate, to))
    if (existing) {
        target = existing
    }
    else if (wholeMove) {
        target = { ...node, fromHostPresences: [{ host: to.host, presence: to.presence }] }
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
            fromHostPresences: [{ host: to.host, presence: to.presence }],
            cover: { members: [] },
        }
        mintedTarget = true
    }

    const targetIsNode = target.universalKey === node.universalKey

    // The whole's own graph: the target takes the entries, the source gives them up (or goes).
    let nextHost = graph
    if (targetIsNode) {
        nextHost = nextHost.replacePresenceNode({
            ...target,
            cover: target.cover,
        })
    }
    else {
        const targetCover = withEntries(target.cover, moved)
        const nextTarget = { ...target, cover: targetCover }
        nextHost = mintedTarget ? nextHost.addPresenceNode(nextTarget) : nextHost.replacePresenceNode(nextTarget)
        nextHost = wholeMove
            ? nextHost.removePresenceNode(node.universalKey)
            : nextHost.replacePresenceNode({ ...node, cover: withoutEntries(node.cover, moved) })
    }
    const next: Graphs = new Map(graphs)
    next.set(step.hostId, nextHost)

    // Children: each moved entry names a child binding, now covered by the target.
    const collisions: { host: EphemeraMembershipHostId; presence: EphemeraPresenceNodeId }[] = []
    if (!targetIsNode) {
        for (const entry of moved) {
            const from = node.universalKey
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
                fromHostPresences: [{ host: step.hostId, presence: target.universalKey }],
            })
            next.set(childHost, repointed)
            if (repointed.presenceNodes.filter((candidate) => pointsAt(candidate, { host: step.hostId, presence: target.universalKey })).length > 1) {
                collisions.push({ host: childHost, presence: entry.presence })
            }
        }
    }

    // The cover index: the entry for this whole's binding leaves its old parent and arrives at its new one.
    // A part move leaves its source binding where it is, so only a whole move changes the source's entry.
    const nodeParent = parentOf(node)
    const targetParent = parentOf(target)
    const leaving = wholeMove && (!targetIsNode || nodeParent?.host !== targetParent?.host || nodeParent?.presence !== targetParent?.presence)
    if (nodeParent && leaving) {
        const failure = writeParentCover(next, step.hostId, nodeParent, (cover) => withoutEntries(cover, [{ host: step.hostId as EphemeraPresenceCoverEntry['host'], presence: node.universalKey }]))
        if (failure) {
            return failure
        }
    }
    if (targetParent) {
        const failure = writeParentCover(next, step.hostId, targetParent, (cover) => withEntries(cover, [{ host: step.hostId as EphemeraPresenceCoverEntry['host'], presence: target.universalKey }]))
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
    return { graphs: dropEmptyUnplaced(result, step.hostId) }
}
