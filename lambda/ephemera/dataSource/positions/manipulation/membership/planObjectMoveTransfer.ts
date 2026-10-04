import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'
import { buildObjectMoveOp } from './buildObjectMoveOp'
import { defaultGetGraph } from '../relational/findRelationalChainsForRemoval'
import { hasPresenceAncestor } from '../../ludicGraph/presenceAncestry'

export type PlanObjectMoveTransferArgs = {
    entityId: EphemeraObjectId
    fromHostId: EphemeraMembershipHostId
    toHostId: EphemeraMembershipHostId
    bundleId: string
    narration: { characterName: string; objectShortName: string }
    /** Hosting kinds only (AB-54); see `ExecuteMembershipTransferArgs.containment`'s doc comment. */
    containment?: 'On' | 'In' | 'PartOf'
    /** injectable for test seams only. */
    getGraph?: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type PlanObjectMoveTransferResult =
    | { ok: true; plan: CompiledPositionKernelPlan; fromHostId: EphemeraMembershipHostId }
    | { ok: false; errorCode: string }

/**
 * Take/drop/give's `plan*`-tier stage: refuses a containment cycle, then builds and compiles the
 * move's own plan --- the transfer, the mover's own containment-edge strip, and (with
 * `containment`) the establish into the new host. Reads, never writes.
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

    const fromGraph = await getGraph(args.fromHostId)

    const buildArgs = {
        entityId: args.entityId,
        fromGraph,
        fromHostId: args.fromHostId,
        toHostId: args.toHostId,
        bundleId: args.bundleId,
        narration: args.narration,
        ...(args.containment ? { containment: args.containment } : {}),
    }

    const plan = compilePositionKernelOp(buildObjectMoveOp(buildArgs))
    return { ok: true, plan, fromHostId: args.fromHostId }
}
