import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { ExecutorParsePlanStep } from './synthesize/executorTypes'
import type { MutationKernelStep } from '../../../positions/manipulation/kernel/kernelStep'

export type DryRunVerdict = 'legal' | 'defer' | 'illegal'

/** `ExecutorOutcome`'s legal arm shape (`synthesize/executor.ts`), carried out of the dry run. */
export type ValidatedPlan = {
    steps: readonly ExecutorParsePlanStep[]
    extraKernelSteps?: readonly MutationKernelStep[]
}

export type DryRunOutcome = {
    verdict: DryRunVerdict
    /** False when an LLM validator would be required (Custom / unmodeled). */
    decidable: boolean
    reason?: string
    /**
     * Membership-only: the validated, fully expanded plan the executor produced, when a
     * `legal` verdict came from `sandboxMembershipDryRun`'s executor-mediated dry run.
     * Absent for relational dry runs and for any non-`legal` verdict.
     */
    plan?: ValidatedPlan
}

export type ValidateMembershipPlanContext = {
    /** When present, exit-edge contact escalates an otherwise-legal atomic to defer. */
    ludicGraph?: EphemeraLudicGraph
    actorCharacterId?: EphemeraCharacterId
}

/**
 * Single-step membership dry-run (FT-2.2). Legality from locus vs operationKind;
 * exit-edge / unmodeled loci defer. No compound sandbox.
 */
export function validateMembershipPlanDryRun(
    candidate: IdentityPlanCandidate,
    context: ValidateMembershipPlanContext = {}
): DryRunOutcome {
    const { locus } = candidate.identity
    const { operationKind } = candidate.plan

    if (locus.kind === 'room') {
        if (operationKind !== 'takeHold') {
            return {
                verdict: 'illegal',
                decidable: true,
                reason: objectManipulationErrorMessages.notCarryingObject,
            }
        }
        return escalateExitEdgeIfNeeded(candidate.identity.objectId, context)
    }

    if (locus.kind === 'heldByActor') {
        if (operationKind !== 'drop') {
            return {
                verdict: 'illegal',
                decidable: true,
                reason: objectManipulationErrorMessages.alreadyHoldingObject,
            }
        }
        return escalateExitEdgeIfNeeded(candidate.identity.objectId, context)
    }

    // heldByOtherCharacter / withinObject: not closed-world atomic in v1
    return {
        verdict: 'defer',
        decidable: false,
        reason: objectManipulationErrorMessages.unimplementedAtomicOperation,
    }
}

function escalateExitEdgeIfNeeded(
    objectId: EphemeraObjectId,
    context: ValidateMembershipPlanContext
): DryRunOutcome {
    if (
        context.ludicGraph !== undefined
        && objectTouchesExitEdgeOnGraph(context.ludicGraph, objectId)
    ) {
        return {
            verdict: 'defer',
            decidable: true,
            reason: 'exitEdge',
        }
    }
    return { verdict: 'legal', decidable: true }
}
