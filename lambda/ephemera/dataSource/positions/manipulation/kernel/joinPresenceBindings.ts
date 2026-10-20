import { BASE_PRESENCE_ID } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { ParentBinding } from '../../ludicGraph/presenceParent'
import { bindingHasParent, parentsOf } from '../../ludicGraph/presenceParent'
import { withEntries } from './endOfRunRules'
import { writeCoverIndex } from './presenceStepWrites'
import type { MutationKernelJoinPresenceBindingsStep } from './kernelStep'

type Graphs = Map<EphemeraMembershipHostId, EphemeraLudicGraph>

/**
 * Bindings of one host that now sit under the same parent: the survivor first. A join leaves these
 * behind one level down (two children of the joined bindings that now share `into`), and the run's end
 * refuses them (the collision rule) unless the producer writes the join, or the fall-through rule caused them under Unplaced.
 */
export type JoinCollision = {
    host: EphemeraMembershipHostId
    presences: EphemeraPresenceNodeId[]
}

const keyOf = (parent: ParentBinding): string => `${parent.host}|${parent.presence}`
const uniqueParents = (parents: readonly ParentBinding[]): ParentBinding[] => (
    [...new Map(parents.map((parent) => [keyOf(parent), { host: parent.host, presence: parent.presence }])).values()]
)

/**
 * The bindings of `host` under `parent`, in graph order with `preferred` ones first, or `undefined`
 * when there are fewer than two (no collision).
 */
const collisionOf = (graphs: Graphs, host: EphemeraMembershipHostId, parent: ParentBinding, preferred: ReadonlySet<EphemeraPresenceNodeId>): JoinCollision | undefined => {
    const under = (graphs.get(host)?.presenceNodes ?? []).filter((node) => bindingHasParent(node, parent)).map(({ universalKey }) => universalKey)
    if (under.length < 2) {
        return undefined
    }
    return { host, presences: [...under.filter((id) => preferred.has(id)), ...under.filter((id) => !preferred.has(id))] }
}

/**
 * The collisions among `entries`' hosts under `parent`, for a caller that put those entries there
 * (the fall-through rule's fall to Unplaced): bindings that were not just placed survive.
 */
export const collisionsUnder = (graphs: Graphs, parent: ParentBinding, entries: readonly EphemeraPresenceCoverEntry[]): JoinCollision[] => {
    const placed = new Set(entries.map(({ presence }) => presence))
    const preferred = new Set((graphs.has(parent.host) ? [...new Set(entries.map(({ host }) => host as EphemeraMembershipHostId))] : []).flatMap((host) => (
        (graphs.get(host)?.presenceNodes ?? []).filter((node) => bindingHasParent(node, parent) && !placed.has(node.universalKey)).map(({ universalKey }) => universalKey)
    )))
    return [...new Set(entries.map(({ host }) => host as EphemeraMembershipHostId))].flatMap((host) => {
        const collision = collisionOf(graphs, host, parent, preferred)
        return collision ? [collision] : []
    })
}

/**
 * Join: the bindings `toJoin` become `into`, which keeps its id. `into` takes the union of
 * their parents and covers; each child of a `toJoin` cover swaps the joined binding for `into` in its
 * parent set (a union, so a shared child collapses to one pointer); the parents' cover entries follow.
 * Reads only existence, never covers: the result is the union whatever the covers hold, so there is no
 * cover read to re-check (the producer joins on a collision, not on what the covers contain). The parent hosts do not change, so
 * membership does not either. Returns the children that now collide under `into`; it does not join them.
 */
export const joinBindings = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    step: Pick<MutationKernelJoinPresenceBindingsStep, 'hostId' | 'into' | 'toJoin'>
): { graphs: Graphs; collisions: JoinCollision[] } | { reasonCode: string } => {
    const graph = graphs.get(step.hostId)
    if (!graph) {
        return { reasonCode: 'hostNotInFootprint' }
    }
    const toJoinIds = [...new Set(step.toJoin)]
    const into = graph.presenceNodes.find(({ universalKey }) => universalKey === step.into)
    const joined = toJoinIds.map((id) => graph.presenceNodes.find(({ universalKey }) => universalKey === id))
    if (!into || joined.some((node) => !node)) {
        return { reasonCode: 'presenceBindingMissing' }
    }
    if (toJoinIds.includes(step.into)) {
        return { reasonCode: 'joinIntoInToJoin' }
    }
    if (toJoinIds.includes(BASE_PRESENCE_ID)) {
        return { reasonCode: 'joinDispensesBase' }
    }
    const joinedNodes = joined as NonNullable<(typeof joined)[number]>[]

    const parents = uniqueParents([...parentsOf(into), ...joinedNodes.flatMap(parentsOf)])
    const cover = joinedNodes.reduce((accumulated, node) => withEntries(accumulated, node.cover.members), withEntries(into.cover, []))
    let next: Graphs = new Map(graphs).set(
        step.hostId,
        joinedNodes.reduce((accumulated, node) => accumulated.removePresenceNode(node.universalKey), graph.replacePresenceNode({ ...into, fromHostPresences: parents, cover }))
    )

    // Children: each entry of a joined cover names a child binding that now sits under `into`.
    const target: ParentBinding = { host: step.hostId, presence: step.into }
    const childHosts = new Set<EphemeraMembershipHostId>()
    for (const node of joinedNodes) {
        for (const entry of node.cover.members) {
            const childHost = entry.host as EphemeraMembershipHostId
            const childGraph = next.get(childHost)
            if (!childGraph) {
                return { reasonCode: 'hostNotInFootprint' }
            }
            const child = childGraph.presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
            if (!child) {
                return { reasonCode: 'presenceBindingMissing' }
            }
            if (!bindingHasParent(child, { host: step.hostId, presence: node.universalKey })) {
                return { reasonCode: 'presenceBindingMoved' }
            }
            const remaining = parentsOf(child).filter((parent) => !(parent.host === step.hostId && parent.presence === node.universalKey))
            next = new Map(next).set(childHost, childGraph.replacePresenceNode({ ...child, fromHostPresences: uniqueParents([...remaining, target]) }))
            childHosts.add(childHost)
        }
    }

    // The cover index: a joined binding's entry leaves its parents, and `into`'s arrives at the new ones.
    for (const node of joinedNodes) {
        next = writeCoverIndex(next, step.hostId, node.universalKey, parentsOf(node), [])
    }
    next = writeCoverIndex(next, step.hostId, step.into, parentsOf(into), parents)

    const preferred = new Set(into.cover.members.map(({ presence }) => presence))
    const collisions = [...childHosts].flatMap((host) => {
        const collision = collisionOf(next, host, target, preferred)
        return collision ? [collision] : []
    })
    return { graphs: next, collisions }
}

/**
 * Joins each collision into its first binding, then the collisions that join leaves one level down, and
 * so on. Only the fall-through rule's fall to Unplaced is joined by the kernel itself; the end of the run refuses any
 * other (the collision rule).
 */
export const joinCollisions = (
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>,
    collisions: readonly JoinCollision[]
): { graphs: Graphs } | { reasonCode: string } => {
    let result: Graphs = new Map(graphs)
    for (const collision of collisions) {
        const [into, ...toJoin] = collision.presences
        const joined = joinBindings(result, { hostId: collision.host, into, toJoin })
        if ('reasonCode' in joined) {
            return joined
        }
        const below = joinCollisions(joined.graphs, joined.collisions)
        if ('reasonCode' in below) {
            return below
        }
        result = below.graphs
    }
    return { graphs: result }
}
