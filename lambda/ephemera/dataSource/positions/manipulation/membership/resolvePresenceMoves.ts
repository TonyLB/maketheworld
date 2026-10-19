import { isEphemeraAreaId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { GroundedPresence } from '../../../actions/enrich/objectManipulation/plan/planStep'
import type { EphemeraLudicGraphStructureNode, EphemeraPresenceCover, EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { childParentBindingIdOf, unpointedBindingOf, parentHostOf, parentOf, parentsOf } from '../../ludicGraph/presenceParent'
import type { PositionKernelPresenceMove } from '../kernel/compile/positionKernelOp'

export type ResolvePresenceMovesArgs = {
    moved: EphemeraMembershipHostId
    froms: readonly EphemeraMembershipHostId[]
    to: EphemeraMembershipHostId | null
    /**
     * Where the destination is seen in the host that holds it (`groundedPresence`): narrows which of
     * the destination's own bindings the mover lands under. Absent, the destination's only binding.
     */
    toGroundedPresence?: readonly GroundedPresence[]
    /**
     * Where the mover is seen in the host it leaves (`groundedPresence`): names which of that host's
     * buckets it sits in, so a mover holding several bindings under one host (a plank under two
     * bindings of a table) is told apart by binding. Absent, the host alone must be enough.
     */
    moverGroundedPresence?: readonly GroundedPresence[]
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type ResolvedPresenceMoves =
    | { ok: true; presenceMoves: PositionKernelPresenceMove[]; mintedRootUuid?: string }
    | { ok: false; errorCode: 'destinationBindingMissing' | 'destinationBindingAmbiguous' | 'moverBindingAmbiguous' }

/**
 * The hosts whose bindings a set of moves into one receiver may merge below it: a child listed under
 * more than one of the covers ends holding several bindings under the receiver, which the move merges
 * one level down, re-pointing the merged bindings' own children, and so on. Names only the hosts; the
 * handler verifies each read under the lock.
 */
const cascadeHostsOf = async (
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>,
    covers: readonly EphemeraPresenceCover[]
): Promise<EphemeraMembershipHostId[]> => {
    const hosts = new Set<EphemeraMembershipHostId>()
    const visit = async (entries: readonly EphemeraPresenceCoverEntry[]): Promise<void> => {
        const byHost = new Map<EphemeraMembershipHostId, EphemeraPresenceCoverEntry[]>()
        for (const entry of entries) {
            byHost.set(entry.host as EphemeraMembershipHostId, [...(byHost.get(entry.host as EphemeraMembershipHostId) ?? []), entry])
        }
        for (const [host, colliding] of byHost) {
            if (colliding.length < 2) {
                continue
            }
            const graph = await getGraph(host)
            const grandchildren = colliding.flatMap(({ presence }) => (
                graph.presenceNodes.find(({ universalKey }) => universalKey === presence)?.cover.members ?? []
            ))
            grandchildren.forEach(({ host: grandchildHost }) => hosts.add(grandchildHost as EphemeraMembershipHostId))
            await visit(grandchildren)
        }
    }
    await visit(covers.flatMap((cover) => cover.members))
    return [...hosts]
}

/** Whether a binding's parent pointer names one of the buckets where its whole is seen. */
const sitsUnderSeenBucket = (
    binding: EphemeraLudicGraphStructureNode,
    seen: readonly GroundedPresence[]
): boolean => seen.some((bucket) => (
    parentsOf(binding).some((parent) => (
        typeof bucket === 'string'
            ? parent.host === bucket
            : parent.host === bucket.host && parent.presence === bucket.presence
    ))
))

/** The bindings of a destination's own graph whose pointer names a bucket where it is seen. */
const bindingsUnderSeenBuckets = (
    destGraph: EphemeraLudicGraph,
    seen: readonly GroundedPresence[]
): EphemeraPresenceNodeId[] => (
    destGraph.presenceNodes
        .filter((node) => sitsUnderSeenBucket(node, seen))
        .map(({ universalKey }) => universalKey)
)

/**
 * The binding of the destination that a mover will sit under: a Room's or Area's hostless
 * remainder; otherwise the one named by where the destination is seen, else its only binding.
 * Never a guess: none, or several, is a refusal the caller reports.
 */
export const destinationBindingOf = (
    destGraph: EphemeraLudicGraph,
    seen: readonly GroundedPresence[] | undefined
): { presence: EphemeraPresenceNodeId } | { errorCode: 'destinationBindingMissing' | 'destinationBindingAmbiguous' } => {
    if (isEphemeraRoomId(destGraph.hostId) || isEphemeraAreaId(destGraph.hostId)) {
        const base = childParentBindingIdOf(destGraph)
        return base ? { presence: base } : { errorCode: 'destinationBindingMissing' }
    }
    if (seen && seen.length > 0) {
        const matches = bindingsUnderSeenBuckets(destGraph, seen)
        if (matches.length === 1) {
            return { presence: matches[0] }
        }
        if (matches.length > 1) {
            return { errorCode: 'destinationBindingAmbiguous' }
        }
    }
    const only = childParentBindingIdOf(destGraph)
    if (only) {
        return { presence: only }
    }
    return { errorCode: destGraph.presenceNodes.length === 0 ? 'destinationBindingMissing' : 'destinationBindingAmbiguous' }
}

/**
 * The planner's half of a binding-addressed move: reads the mover's graph and the destination's and
 * names every binding the kernel will move (`PositionKernelMoveOp.presenceMoves`). The kernel
 * re-verifies each inside the lock, so a read gone stale is `stale`, not a wrong write.
 *
 * - **A departure** (`to: null`) names every binding of the mover that sits under a `from` host
 *   (`to: null` on each): they all leave, so there is nothing to tell apart. A mover with none names
 *   nothing, and any node it holds in those hosts is drift the kernel leaves to the sweeps.
 * - **A mover with a binding under each `from` host** moves those bindings. Several under one
 *   host are told apart by where the mover is seen (`moverGroundedPresence`); still several, or no
 *   such name, is a refusal.
 * - **Several moves** (a scrub) converge on one binding, so a child listed under two of them ends
 *   holding two bindings under it and has them merged by the same move one level down. The planner
 *   reads down that chain only to name the hosts (`cascadeHosts`) the footprint must lock; the
 *   kernel re-verifies under the lock.
 * - **A mover with none** (a first placement, a connect, or a legacy whole) moves its hostless
 *   binding, `from: null`; if it holds no hostless binding, a root is minted ahead of the move.
 */
export const resolvePresenceMoves = async (args: ResolvePresenceMovesArgs): Promise<ResolvedPresenceMoves> => {
    if (args.to === null) {
        const departing = (await args.getGraph(args.moved)).presenceNodes.flatMap((node) => {
            const from = parentOf(node)
            return from && args.froms.includes(from.host) ? [{ presence: node.universalKey, from, to: null, cover: node.cover }] : []
        })
        const cascadeHosts = await cascadeHostsOf(args.getGraph, departing.map(({ cover }) => cover))
        return {
            ok: true,
            presenceMoves: departing.map((move) => ({ ...move, ...(cascadeHosts.length > 0 ? { cascadeHosts } : {}) })),
        }
    }
    const destination = destinationBindingOf(await args.getGraph(args.to), args.toGroundedPresence)
    if ('errorCode' in destination) {
        return { ok: false, errorCode: destination.errorCode }
    }
    const to = { host: args.to, presence: destination.presence }

    const moverGraph = await args.getGraph(args.moved)
    const departing = args.froms.map((fromHostId) => {
        const underHost = moverGraph.presenceNodes.filter((node) => parentHostOf(node) === fromHostId)
        const seen = args.moverGroundedPresence
        const narrowed = underHost.length > 1 && seen && seen.length > 0
            ? underHost.filter((node) => sitsUnderSeenBucket(node, seen))
            : underHost
        return narrowed.length > 0 ? narrowed : underHost
    })
    if (departing.some((nodes) => nodes.length > 1)) {
        return { ok: false, errorCode: 'moverBindingAmbiguous' }
    }
    const named = departing.flatMap((nodes) => nodes)
    if (named.length > 0) {
        const cascadeHosts = named.length > 1 ? await cascadeHostsOf(args.getGraph, named.map(({ cover }) => cover)) : []
        return {
            ok: true,
            presenceMoves: named.map((node) => ({ presence: node.universalKey, from: parentOf(node) ?? null, to, cover: node.cover, ...(cascadeHosts.length > 0 ? { cascadeHosts } : {}) })),
        }
    }

    const hostless = unpointedBindingOf(moverGraph)
    if (hostless) {
        return { ok: true, presenceMoves: [{ presence: hostless.universalKey, from: null, to }] }
    }
    // A mover holding no binding at all has no Base yet (a whole holds Base from creation on), so the root it
    // is placed from is its Base.
    const mintedRootUuid = 'Base'
    return {
        ok: true,
        presenceMoves: [{ presence: PresenceKey(mintedRootUuid) as EphemeraPresenceNodeId, from: null, to }],
        mintedRootUuid,
    }
}
