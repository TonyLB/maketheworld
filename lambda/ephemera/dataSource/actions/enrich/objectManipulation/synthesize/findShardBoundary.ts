import type {
    EphemeraMembershipHostId,
    EphemeraPositionAdjacencyContainedId,
} from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraObjectId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

/**
 * PV1-3's general-case shard-boundary predicate. Unlike `expandSameHost.ts` (which asks "do
 * these two already share a host?"), this asks "is there ANY host either endpoint's containment
 * ancestry reaches that the other's also reaches?" -- the third `expandSameHost` outcome
 * (crossing a boundary with a port pair) needs this answer before it can build legs.
 *
 * A closest common ancestor is not the pair with the smallest *combined* depth -- it is a node
 * on the Pareto-minimal frontier of the two per-endpoint depth functions. Concretely: a common
 * node C is excluded if some other common node C' is reachable at depth <= C's depth from BOTH
 * endpoints (with at least one strictly less) -- routing through C would mean walking up past
 * C' (a perfectly good crossing point already) and back down through it again. Multiplicity (a
 * host contained by more than one thing, at any depth) is exactly what can make this frontier
 * have more than one member: two branches can each dominate a different candidate without
 * dominating each other.
 */
export type FindShardBoundaryResult =
    | { verdict: 'notFound' }
    | {
        verdict: 'crossed'
        commonAncestor: EphemeraMembershipHostId
        /** Hosts crossed from `subjectId` up to and including the common ancestor -- excludes `subjectId` itself. */
        subjectPath: EphemeraMembershipHostId[]
        /** Hosts crossed from `targetId` up to and including the common ancestor -- excludes `targetId` itself. */
        targetPath: EphemeraMembershipHostId[]
    }
    | { verdict: 'ambiguous'; commonAncestors: EphemeraMembershipHostId[] }

/**
 * `EphemeraPositionAdjacencyContainedId` (Character/Object/Feature) is exactly the set
 * `getMembershipContainers` accepts -- Room and Area are containment leaves with no membership
 * row of their own, so a walk terminates the instant it reaches one, without a further call.
 */
const isPositionAdjacencyContainedId = (
    id: EphemeraMembershipHostId
): id is EphemeraPositionAdjacencyContainedId =>
    isEphemeraCharacterId(id) || isEphemeraObjectId(id) || isEphemeraFeatureId(id)

type Ancestry = {
    /** Shortest hop-count from the walk's start to each reachable host. */
    depth: Map<EphemeraMembershipHostId, number>
    /** containerId -> the node (start id or an intermediate host) that led to it in the BFS. */
    reachedVia: Map<EphemeraMembershipHostId, EphemeraMembershipHostId>
}

/**
 * BFS from `startId`, calling `getMembershipContainers` uniformly at every node reached (no
 * single-parent assumption at any depth) until every branch terminates at a Room or Area.
 * Shortest-hop `depth` is what the Pareto-domination check below compares on; ties (two routes
 * to the same host at the same depth) keep whichever was discovered first, which is immaterial
 * since only the depth number is compared, not the specific route.
 */
const walkAncestry = (
    startId: EphemeraPositionAdjacencyContainedId,
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => EphemeraMembershipHostId[]
): Ancestry => {
    const depth = new Map<EphemeraMembershipHostId, number>()
    const reachedVia = new Map<EphemeraMembershipHostId, EphemeraMembershipHostId>()
    const visited = new Set<EphemeraMembershipHostId>()
    let frontier: EphemeraMembershipHostId[] = [startId]
    let currentDepth = 0

    while (frontier.length > 0) {
        const next: EphemeraMembershipHostId[] = []
        for (const nodeId of frontier) {
            if (!isPositionAdjacencyContainedId(nodeId)) continue
            for (const containerId of getMembershipContainers(nodeId)) {
                if (visited.has(containerId)) continue
                visited.add(containerId)
                depth.set(containerId, currentDepth + 1)
                reachedVia.set(containerId, nodeId)
                next.push(containerId)
            }
        }
        frontier = next
        currentDepth += 1
    }

    return { depth, reachedVia }
}

/** Reconstructs the host chain from `startId` (exclusive) up to `ancestorId` (inclusive). */
const pathToAncestor = (
    startId: EphemeraPositionAdjacencyContainedId,
    ancestorId: EphemeraMembershipHostId,
    reachedVia: Map<EphemeraMembershipHostId, EphemeraMembershipHostId>
): EphemeraMembershipHostId[] => {
    if (ancestorId === startId) {
        return []
    }
    const path: EphemeraMembershipHostId[] = [ancestorId]
    let current = ancestorId
    for (;;) {
        const prev = reachedVia.get(current)
        if (prev === undefined || prev === startId) {
            break
        }
        path.unshift(prev)
        current = prev
    }
    return path
}

export const findShardBoundary = (
    input: { subjectId: EphemeraPositionAdjacencyContainedId; targetId: EphemeraPositionAdjacencyContainedId },
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => EphemeraMembershipHostId[]
): FindShardBoundaryResult => {
    const { subjectId, targetId } = input

    const subjectAncestry = walkAncestry(subjectId, getMembershipContainers)
    const targetAncestry = walkAncestry(targetId, getMembershipContainers)

    const commonNodes = [...subjectAncestry.depth.keys()].filter((id) => targetAncestry.depth.has(id))

    if (commonNodes.length === 0) {
        return { verdict: 'notFound' }
    }

    const isDominated = (candidateId: EphemeraMembershipHostId): boolean => {
        const candidateSubjectDepth = subjectAncestry.depth.get(candidateId)!
        const candidateTargetDepth = targetAncestry.depth.get(candidateId)!
        return commonNodes.some((otherId) => {
            if (otherId === candidateId) return false
            const otherSubjectDepth = subjectAncestry.depth.get(otherId)!
            const otherTargetDepth = targetAncestry.depth.get(otherId)!
            const noWorse = otherSubjectDepth <= candidateSubjectDepth && otherTargetDepth <= candidateTargetDepth
            const strictlyBetter = otherSubjectDepth < candidateSubjectDepth || otherTargetDepth < candidateTargetDepth
            return noWorse && strictlyBetter
        })
    }

    const closest = commonNodes.filter((id) => !isDominated(id))

    if (closest.length > 1) {
        return { verdict: 'ambiguous', commonAncestors: closest }
    }

    const [commonAncestor] = closest
    return {
        verdict: 'crossed',
        commonAncestor,
        subjectPath: pathToAncestor(subjectId, commonAncestor, subjectAncestry.reachedVia),
        targetPath: pathToAncestor(targetId, commonAncestor, targetAncestry.reachedVia),
    }
}
