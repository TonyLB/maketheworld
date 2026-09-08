import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import { isKernelMutationStep } from '../kernel/kernelStep'
import { dryRunStepSequence } from '../kernel/dryRunStepSequence'
import { compilePositionKernelOp } from '../kernel/compile/compilePositionKernelOp'
import type { CompiledPositionKernelPlan } from '../kernel/compile/compilePositionKernelOp'
import { buildObjectMoveOp } from './buildObjectMoveOp'
import { repairMechanicalDissolve } from './repairMechanicalDissolve'
import { defaultGetGraph } from '../relational/findRelationalChainsForRemoval'

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
 * Take/drop/give's `plan*`-tier stage (3d, 2026-09-08): the sole surviving caller of
 * `executeMembershipTransfer`'s retired `honorDefer` mode, replaced by a real dry run (3c's
 * `dryRunStepSequence`) instead of a hand-rolled `boundaryEdgeOutcomes` pre-check. Reads and
 * evaluates, never writes --- `orchestrateObjectMove` still owns the commit and present calls.
 *
 * `legal` -> the built plan is returned as-is. `repairable` -> handed to
 * `repairMechanicalDissolve`, take/drop's repair-authority policy ("may not silently move the
 * lamp"): a `mechanical` repair is folded into a rebuilt plan (no second dry run --- 3c's own doc
 * comment: the cross-snapshot recheck belongs to commit against locked graphs, not to a repeat dry
 * run against the same unchanged snapshot); anything else is refused, `ok: false`, carrying the
 * real reason code `honorDefer` used to discard. `stale` -> also refused, unchanged today --- a
 * re-fetch-and-retry loop is MS-15's, not built here.
 */
export const planObjectMoveTransfer = async (
    args: PlanObjectMoveTransferArgs
): Promise<PlanObjectMoveTransferResult> => {
    const getGraph = args.getGraph ?? defaultGetGraph
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

    const outcome = await dryRunStepSequence(
        plan.steps.filter(isKernelMutationStep),
        { getCurrentHost: () => args.fromHostId, getGraph }
    )

    if (outcome.verdict === 'legal') {
        return { ok: true, plan, fromHostId: args.fromHostId }
    }

    if (outcome.verdict === 'repairable') {
        const repaired = repairMechanicalDissolve(outcome.repair, outcome.authority)
        if (!repaired.ok) {
            return { ok: false, errorCode: outcome.reasonCode }
        }
        const repairedPlan = compilePositionKernelOp(buildObjectMoveOp({
            ...buildArgs,
            extraDissolvedEdges: [repaired.edge],
        }))
        return { ok: true, plan: repairedPlan, fromHostId: args.fromHostId }
    }

    // stale --- MS-15's, not this slice's; no re-fetch loop.
    return { ok: false, errorCode: outcome.reasonCode }
}
