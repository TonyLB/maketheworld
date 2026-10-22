import type { EphemeraObjectId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'
import { buildObjectMoveOp } from './buildObjectMoveOp'
import { defaultGetGraph } from '../relational/findRelationalChainsForRemoval'
import { hasPresenceAncestor } from '../../ludicGraph/presenceAncestry'
import { parentHostsOf } from '../../ludicGraph/presenceParent'

/** The distinct hosts a view's bindings sit under on the mover's graph, in view order; `undefined` when a binding is gone. */
const hostsOfView = (mover: EphemeraLudicGraph, view: readonly EphemeraPresenceNodeId[]): EphemeraMembershipHostId[] | undefined => {
    const nodes = view.map((binding) => mover.presenceNodes.find(({ universalKey }) => universalKey === binding))
    return nodes.some((node) => node === undefined) ? undefined : [...new Set(nodes.flatMap((node) => parentHostsOf(node!)))]
}
import { bindingHasParentOn } from '../../ludicGraph/presenceParent'
import { resolvePresenceMoves } from './resolvePresenceMoves'

export type PlanObjectMoveTransferArgs = {
    entityId: EphemeraObjectId
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
    /** The binding of the destination the mover lands under (the destination's `view`); absent, its only binding. */
    toBinding?: EphemeraPresenceNodeId
    /**
     * The bindings of the mover that move (the mover's `view`). Every host they sit under is left, so a
     * take of the whole of an object in several hosts leaves them all, and a take of one part leaves one.
     * Absent, the mover's one binding under `fromHostId`.
     */
    moverBindings?: readonly EphemeraPresenceNodeId[]
    /** Hosting kinds only (AB-54); see `ExecuteMembershipTransferArgs.containment`'s doc comment. */
    containment?: 'On' | 'In' | 'PartOf'
    /** A spread: the mover gains `toHostId` and stays in `fromHostId` (`resolvePresenceMoves`'s `keepFroms`). */
    keepFrom?: true
    /** injectable for test seams only. */
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type PlanObjectMoveTransferResult =
    | { ok: true; plan: CompiledPositionKernelPlan; fromHostId: EphemeraMembershipHostId }
    | { ok: false; errorCode: string }

/**
 * Take/drop/give's `plan*`-tier stage: refuses a containment cycle, then builds and compiles the
 * move's own plan --- the transfer, the mover's own containment-edge strip (not on a spread,
 * `keepFrom`), and (with `containment`) the establish into the new host. Reads, never writes.
 *
 * It does not dry-run, and derives no boundary-edge dissolve. Those dissolves are the command
 * attempt's own facilitating actions, committed as sibling fragments, so this fragment alone
 * would always look illegal for an object with a boundary edge. `commitAttempt` dry-runs the
 * whole attempt's combined sequence instead.
 */
export const planObjectMoveTransfer = async (
    args: PlanObjectMoveTransferArgs
): Promise<PlanObjectMoveTransferResult> => {
    const getGraph = args.getGraph ?? defaultGetGraph

    // Refuse a move into the mover itself or anything inside it (AB-63): the commit would close a
    // containment cycle, leaving both objects unreachable from any room. Only a move can add a
    // containment link, so checking each one keeps the whole structure acyclic. Checked here, not
    // under lock: a concurrent move along the same chain can still slip past (see AB-63's row).
    if (await hasPresenceAncestor(args.toHostId, args.entityId, getGraph)) {
        return { ok: false, errorCode: 'containmentCycle' }
    }

    // A move of a view starts from every host its bindings sit under, read off the mover's own graph (pointers govern).
    const mover = args.moverBindings !== undefined ? await getGraph(args.entityId) : undefined
    const viewHosts = mover !== undefined ? hostsOfView(mover, args.moverBindings!) : undefined
    if (args.moverBindings !== undefined && (viewHosts === undefined || viewHosts.length === 0)) {
        return { ok: false, errorCode: 'moverBindingMissing' }
    }
    if (viewHosts?.includes(args.toHostId)) {
        return { ok: false, errorCode: 'alreadyOnDestination' }
    }
    const froms = viewHosts ?? [args.fromHostId]
    const departures = await Promise.all(froms.map(async (hostId) => ({ hostId, graph: await getGraph(hostId) })))

    const resolved = await resolvePresenceMoves({
        moved: args.entityId,
        froms,
        to: args.toHostId,
        ...(args.toBinding ? { toBinding: args.toBinding } : {}),
        ...(args.moverBindings ? { moverBindings: args.moverBindings } : {}),
        ...(args.keepFrom ? { keepFroms: true as const } : {}),
        getGraph,
    })
    if (!resolved.ok) {
        return { ok: false, errorCode: resolved.errorCode }
    }

    // A view-move leaves its host only if no other binding of the mover stays under it:
    // the mover's own containment edge in that host, and its departure, are then untouched (as on a spread).
    const staysInFrom = mover !== undefined && mover.presenceNodes.some((node) => (
        !args.moverBindings!.includes(node.universalKey) && froms.some((hostId) => bindingHasParentOn(node, hostId))
    ))

    const buildArgs = {
        entityId: args.entityId,
        departures,
        toHostId: args.toHostId,
        presenceSteps: resolved.steps,
        ...(args.containment ? { containment: args.containment } : {}),
        ...(args.keepFrom || staysInFrom ? { keepFrom: true as const } : {}),
    }

    const plan = compilePositionKernelOp(buildObjectMoveOp(buildArgs))
    return { ok: true, plan, fromHostId: froms[0]! }
}
