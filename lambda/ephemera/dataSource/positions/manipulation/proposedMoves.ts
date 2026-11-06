import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraHostingKind } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../ludicGraph'
import { bindingHasParentOn } from '../ludicGraph/presenceParent'
import { applyStepSequenceCore } from './kernel/applyStepSequenceCore'
import { isKernelMutationStep } from './kernel/kernelStep'
import { planObjectMoveTransfer } from './membership/planObjectMoveTransfer'

/** One move of a proposal: what `planObjectMoveTransfer` takes, whoever supplies it (a fixture now; a template or a proposer later). */
export type ProposedMove = {
    moved: EphemeraObjectId
    from: EphemeraMembershipHostId
    to: EphemeraMembershipHostId
    hostingKind?: EphemeraHostingKind
}

export type ProposedMovesOutcome =
    | { verdict: 'legal'; moves: readonly ProposedMove[]; graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph> }
    | { verdict: 'refused'; move: ProposedMove; reason: string }

/**
 * A proposal's dry run: each move planned against the graphs as the moves before it left them, then applied by the kernel. Reads and
 * writes nothing but the map it is given. A refusal is the planner's error code or the kernel's reason code, for this literal move and
 * not the request behind it: a `securedToBlocksMove` says these moves are out, and a planner might still find others.
 *
 * The check that the mover is on `from` is the dry run's own, as it is the caller's for the planner in `commitAttempt`: to the planner, a
 * mover with no binding under `from` is a first placement, and it would come out in two places.
 *
 * It derives no boundary-edge dissolves, which are the command attempt's own facilitating actions (`planObjectMoveTransfer`), so a mover
 * with an ordinary boundary edge comes back refused, as `unresolvedDissolveEdge` or the like.
 */
export const dryRunProposedMoves = async (
    moves: readonly ProposedMove[],
    graphs: ReadonlyMap<EphemeraMembershipHostId, EphemeraLudicGraph>
): Promise<ProposedMovesOutcome> => moves.reduce<Promise<ProposedMovesOutcome>>(async (previous, move) => {
    const sofar = await previous
    if (sofar.verdict !== 'legal') {
        return sofar
    }
    if (!sofar.graphs.get(move.moved)?.presenceNodes.some((node) => bindingHasParentOn(node, move.from))) {
        return { verdict: 'refused', move, reason: 'moverNotOnFromHost' }
    }
    const plan = await planObjectMoveTransfer({
        entityId: move.moved,
        fromHostId: move.from,
        toHostId: move.to,
        ...(move.hostingKind ? { hostingKind: move.hostingKind } : {}),
        getGraph: async (hostId) => {
            const graph = sofar.graphs.get(hostId)
            if (graph === undefined) {
                throw new Error(`dryRunProposedMoves: no graph for ${hostId}`)
            }
            return graph
        },
    })
    if (!plan.ok) {
        return { verdict: 'refused', move, reason: plan.errorCode }
    }
    const applied = applyStepSequenceCore(plan.plan.steps.filter(isKernelMutationStep), sofar.graphs)
    return applied.verdict === 'legal'
        ? { verdict: 'legal', moves, graphs: applied.graphs }
        : { verdict: 'refused', move, reason: applied.reasonCode }
}, Promise.resolve({ verdict: 'legal', moves, graphs }))
