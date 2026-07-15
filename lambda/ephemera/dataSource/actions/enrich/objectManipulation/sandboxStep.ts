import type { EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import { applyTransferSet } from '../../../positions/positionGraph/expandValidate/applyTransferSet'
import type { IdentityPlanCandidate, RelationalIdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SandboxState } from './sandboxState'
import {
    validateMembershipPlanDryRun,
    validateRelationalPlanDryRun,
    type ValidateMembershipPlanContext,
} from './validatePlanDryRun'

export type SandboxStepOutcome =
    | { verdict: 'legal'; decidable: true; state: SandboxState }
    | { verdict: 'illegal' | 'defer'; decidable: boolean; reason: string }

export type TransferMembershipStepContext = {
    sourceHostId: EphemeraMembershipHostId
    destinationHostId: EphemeraMembershipHostId
    membershipContext?: ValidateMembershipPlanContext
}

/**
 * Single-step transition for `transferMembership` (FT-2.2 base check composed
 * with the S2 interaction-under-transfer check, per the "universal gating"
 * scope decision --- every membership transfer, not only compound ones).
 *
 * The sandbox validates completeness; it never expands `transferSet` itself
 * (see "Construction vs. validation" in the sandbox planning doc). A `carry`
 * boundary outcome means the caller under-specified the transfer set --- that
 * is `illegal` (a deterministic candidate-construction defect), not `defer`
 * (which is reserved for genuine interaction-assessment cases: `Under`
 * subject-move, `Custom`).
 */
export function applyTransferMembershipStep(
    state: SandboxState,
    candidate: IdentityPlanCandidate,
    transferSet: ReadonlySet<EphemeraObjectId>,
    context: TransferMembershipStepContext
): SandboxStepOutcome {
    const sourceGraph = state.get(context.sourceHostId)
    if (sourceGraph === undefined) {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.noMembershipHost,
        }
    }

    const baseOutcome = validateMembershipPlanDryRun(candidate, {
        ...context.membershipContext,
        positionGraph: sourceGraph,
    })
    if (baseOutcome.verdict !== 'legal') {
        return {
            verdict: baseOutcome.verdict,
            decidable: baseOutcome.decidable,
            reason: baseOutcome.reason ?? objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    const destinationGraph = state.get(context.destinationHostId)
    if (destinationGraph === undefined) {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.noMembershipHost,
        }
    }

    // `addRelationalEdge`, not `applyRelationalPatch`, inside `applyTransferSet`: the sandbox
    // never persists, so it is not subject to `applyRelationalPatch`'s room-only guard (BD-13
    // kernel blocker, tracked in the parent plan) --- that guard only matters once the real
    // kernel needs to persist a carried edge onto a Character host.
    const transferOutcome = applyTransferSet(sourceGraph, destinationGraph, transferSet)

    if (transferOutcome.verdict === 'illegal') {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.incompleteTransferSet,
        }
    }
    if (transferOutcome.verdict === 'defer') {
        return {
            verdict: 'defer',
            decidable: transferOutcome.decidable,
            reason: objectManipulationErrorMessages.transferInteractionDefer,
        }
    }

    const nextState: SandboxState = new Map(state)
    nextState.set(context.sourceHostId, transferOutcome.sourceGraph)
    nextState.set(context.destinationHostId, transferOutcome.destGraph)

    return { verdict: 'legal', decidable: true, state: nextState }
}

/**
 * Single-step transition for `establishRelation` / `dissolveRelation`. Thin
 * wrapper over the shipped `validateRelationalPlanDryRun` (FT-3.3) --- no
 * interaction-under-transfer involvement, since that table only governs what
 * happens to an edge when an object *transfers*, not when a relation is
 * created or removed directly.
 */
export function applyRelationalStep(
    state: SandboxState,
    candidate: RelationalIdentityPlanCandidate,
    hostId: EphemeraRoomId
): SandboxStepOutcome {
    const graph = state.get(hostId)
    if (graph === undefined) {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.notOnHostGraph,
        }
    }

    const baseOutcome = validateRelationalPlanDryRun(candidate, { positionGraph: graph })
    if (baseOutcome.verdict !== 'legal') {
        return {
            verdict: baseOutcome.verdict,
            decidable: baseOutcome.decidable,
            reason: baseOutcome.reason ?? objectManipulationErrorMessages.complexRelational,
        }
    }

    const edge = {
        from: candidate.subject.objectId,
        to: candidate.target.objectId,
        kind: candidate.plan.relation.kind,
        ...(candidate.plan.relation.type === 'custom' ? { relationLabel: candidate.plan.relation.relationLabel } : {}),
    }
    const nextGraph = graph.applyRelationalPatch({
        hostId,
        edge,
        op: candidate.plan.operationKind === 'establishRelation' ? 'add' : 'remove',
    })

    const nextState: SandboxState = new Map(state)
    nextState.set(hostId, nextGraph)

    return { verdict: 'legal', decidable: true, state: nextState }
}
