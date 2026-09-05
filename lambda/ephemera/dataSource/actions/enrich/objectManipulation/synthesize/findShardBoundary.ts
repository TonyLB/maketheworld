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
 * The general-case shard-boundary predicate. Unlike `expandSameHost.ts` (which asks "do
 * these two already share a host?"), this asks "is there ANY host either endpoint's containment
 * ancestry reaches that the other's also reaches?" -- the third `expandSameHost` outcome
 * (crossing a boundary with a port pair) needs this answer before it can build legs.
 *
 * **An endpoint is its own zero-hop ancestor**, so an endpoint can itself be the
 * common ancestor: `tie the cup to the table it is sitting on` resolves to the table, not the
 * room above it. Every object host carries a default graph rooted at itself (`fromPlainHostMeta`,
 * `ludicGraph/index.ts`), so a container endpoint is a real node of the graph its own contained
 * endpoint already lives in -- there is nothing to cross. Recording only containers made that
 * shape invisible, and routed both endpoints up to the room to mint a port that connects two
 * things already on one graph.
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
        /**
         * Hosts crossed from `subjectId` up to and including the common ancestor -- excludes
         * `subjectId` itself, so **empty means `subjectId` IS the common ancestor** (its own
         * zero-hop ancestor, see above): nothing is crossed on this side.
         */
        subjectPath: EphemeraMembershipHostId[]
        /** As `subjectPath`, from `targetId` -- empty means `targetId` is itself the common ancestor. */
        targetPath: EphemeraMembershipHostId[]
    }
    | { verdict: 'ambiguous'; commonAncestors: EphemeraMembershipHostId[] }

/**
 * `EphemeraPositionAdjacencyContainedId` (Character/Object/Feature) is exactly the set
 * `getMembershipContainers` accepts -- Room and Area are containment leaves with no membership
 * row of their own, so a walk terminates the instant it reaches one, without a further call.
 */
export const isPositionAdjacencyContainedId = (
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
 *
 * `startId` is seeded at depth 0 -- it is its own ancestor, reached by crossing nothing.
 * It is seeded into `visited` for the same reason, not as an optimization: a containment cycle
 * (`A` contains `B`, `B` contains `A`) otherwise re-discovers the start id further up and
 * overwrites its depth 0 with a nonzero one, which would silently un-do the zero-hop rule for
 * exactly the nested shapes it exists to get right. No `reachedVia` entry is recorded for it --
 * `pathToAncestor` short-circuits on the start id and never consults one.
 */
const walkAncestry = (
    startId: EphemeraPositionAdjacencyContainedId,
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => EphemeraMembershipHostId[]
): Ancestry => {
    const depth = new Map<EphemeraMembershipHostId, number>()
    const reachedVia = new Map<EphemeraMembershipHostId, EphemeraMembershipHostId>()
    const visited = new Set<EphemeraMembershipHostId>()
    depth.set(startId, 0)
    visited.add(startId)
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

/**
 * async counterpart to `walkAncestry`, used to eagerly pre-fetch each endpoint's full
 * containment ancestry (not just one hop) before the executor's own synchronous
 * `ExpansionEnvironment` is built (`compileRelationalFromSkeleton.ts`). Same frontier-expansion /
 * visited-set shape as `walkAncestry` above -- kept as a near-duplicate on purpose so the two stay
 * easy to compare -- but calls the real async `getMembershipContainers` gateway and returns a flat
 * `containerId -> its own direct containers` map instead of `{depth, reachedVia}`: the caller only
 * needs to answer "what are X's containers" for any node this walk reached, and `findShardBoundary`
 * re-derives depth/paths itself, synchronously, once that map is in hand.
 *
 * `depthCap` (default 5, matching the existing referent-search testing bound) stops a branch after that many hops
 * rather than walking indefinitely. `startId` is not recorded as its own entry -- unlike
 * `walkAncestry`'s depth-0 seed, there is nothing to answer for `startId` itself here except its
 * own containers, which the first frontier step already fetches and records.
 */
export const walkAncestryContainers = async (
    startId: EphemeraPositionAdjacencyContainedId,
    getMembershipContainers: (id: EphemeraPositionAdjacencyContainedId) => Promise<EphemeraMembershipHostId[]>,
    depthCap: number = 5
): Promise<Map<EphemeraMembershipHostId, EphemeraMembershipHostId[]>> => {
    const containersByHostId = new Map<EphemeraMembershipHostId, EphemeraMembershipHostId[]>()
    const visited = new Set<EphemeraMembershipHostId>([startId])
    let frontier: EphemeraPositionAdjacencyContainedId[] = [startId]
    let currentDepth = 0

    while (frontier.length > 0 && currentDepth < depthCap) {
        const next: EphemeraPositionAdjacencyContainedId[] = []
        await Promise.all(frontier.map(async (nodeId) => {
            const containers = await getMembershipContainers(nodeId)
            containersByHostId.set(nodeId, containers)
            for (const containerId of containers) {
                if (visited.has(containerId)) continue
                visited.add(containerId)
                if (isPositionAdjacencyContainedId(containerId)) {
                    next.push(containerId)
                }
            }
        }))
        frontier = next
        currentDepth += 1
    }

    return containersByHostId
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
