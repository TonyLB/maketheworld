import { v4 as uuidv4 } from 'uuid'
import { isEphemeraAreaId, isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { GroundedPresence } from '../../../actions/enrich/objectManipulation/plan/planStep'
import type { EphemeraLudicGraphStructureNode } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { childParentBindingIdOf, hostlessRemainderOf, parentHostOf, parentOf } from '../../ludicGraph/presenceParent'
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

/** Whether a binding's parent pointer names one of the buckets where its whole is seen. */
const sitsUnderSeenBucket = (
    { fromHostPresence }: EphemeraLudicGraphStructureNode,
    seen: readonly GroundedPresence[]
): boolean => seen.some((bucket) => (
    typeof bucket === 'string'
        ? fromHostPresence?.host === bucket
        : fromHostPresence?.host === bucket.host && fromHostPresence?.presence === bucket.presence
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
        const remainder = hostlessRemainderOf(destGraph)
        return remainder ? { presence: remainder.universalKey } : { errorCode: 'destinationBindingMissing' }
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
 * - **A mover with none** (a first placement, a connect, or a legacy whole) moves its hostless
 *   binding, `from: null`; if it holds no hostless binding, a root is minted ahead of the move.
 */
export const resolvePresenceMoves = async (args: ResolvePresenceMovesArgs): Promise<ResolvedPresenceMoves> => {
    if (args.to === null) {
        const departing = (await args.getGraph(args.moved)).presenceNodes.flatMap((node) => {
            const from = parentOf(node)
            return from && args.froms.includes(from.host) ? [{ presence: node.universalKey, from, to: null }] : []
        })
        return { ok: true, presenceMoves: departing }
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
        return {
            ok: true,
            presenceMoves: named.map((node) => ({ presence: node.universalKey, from: parentOf(node) ?? null, to })),
        }
    }

    const hostless = hostlessRemainderOf(moverGraph)
    if (hostless) {
        return { ok: true, presenceMoves: [{ presence: hostless.universalKey, from: null, to }] }
    }
    const mintedRootUuid = uuidv4()
    return {
        ok: true,
        presenceMoves: [{ presence: PresenceKey(mintedRootUuid) as EphemeraPresenceNodeId, from: null, to }],
        mintedRootUuid,
    }
}
