import type { EphemeraObjectId, EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
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
    /** The kind the mover holds at the destination; see `PositionKernelMoveOp.hostingKind`'s doc comment. */
    hostingKind?: EphemeraHostingKind
    /** injectable for test seams only. */
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type PlanObjectMoveTransferResult =
    | { ok: true; plan: CompiledPositionKernelPlan; fromHostId: EphemeraMembershipHostId }
    | { ok: false; errorCode: string }

/**
 * Take/drop/give's `plan*`-tier stage: refuses a containment cycle, then builds and compiles the
 * move's own plan --- the transfer, the mover's own containment-edge strip in each host it
 * leaves, and (with `hostingKind`) the kind it holds in the new host. Reads, never writes.
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

    const resolved = await resolvePresenceMoves({
        moved: args.entityId,
        froms,
        to: args.toHostId,
        ...(args.toBinding ? { toBinding: args.toBinding } : {}),
        ...(args.moverBindings ? { moverBindings: args.moverBindings } : {}),
        getGraph,
    })
    if (!resolved.ok) {
        return { ok: false, errorCode: resolved.errorCode }
    }

    // A view-move leaves a host only if no other binding of the mover stays under it: the mover's own
    // node (and its hosting kind) in a host it stays in is untouched.
    const left = mover === undefined ? froms : froms.filter((hostId) => !mover.presenceNodes.some((node) => (
        !args.moverBindings!.includes(node.universalKey) && bindingHasParentOn(node, hostId)
    )))
    // `In` a character is possession, which the arrival default already writes as `Held`: an `In`
    // there would be a kind the character host refuses (hostingKindOnNode HK-3).
    const hostingKind = args.hostingKind === 'In' && isEphemeraCharacterId(args.toHostId) ? undefined : args.hostingKind

    const buildArgs = {
        entityId: args.entityId,
        departures: left,
        toHostId: args.toHostId,
        presenceSteps: resolved.steps,
        ...(hostingKind ? { hostingKind } : {}),
    }

    const plan = compilePositionKernelOp(buildObjectMoveOp(buildArgs))
    return { ok: true, plan, fromHostId: froms[0]! }
}
