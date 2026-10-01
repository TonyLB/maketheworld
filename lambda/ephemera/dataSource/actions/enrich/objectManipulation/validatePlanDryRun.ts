import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraLudicGraph } from '../../../positions/ludicGraph'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { membershipOperationKindFromLocus } from './identityPlanCandidate'
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
}

/**
 * Validates a `transferMembership` step (FT-2.2): the object's actual host must equal the
 * host the step's `from` referent requires, or an exit edge defers. For v1 loci, `from`
 * grounds to the room for `takeHold` and to the actor for `drop` (`planMembershipDesiredResult`),
 * so `membershipOperationKindFromLocus` --- the locus's own inverse of that mapping --- is
 * read as "does the locus satisfy `from`" rather than a bare operationKind table.
 * `heldByOtherCharacter` / `withinObject` loci are not closed-world atomic in v1 and defer.
 */
export function validateMembershipPlanDryRun(
    candidate: IdentityPlanCandidate,
    context: ValidateMembershipPlanContext = {}
): DryRunOutcome {
    const { locus } = candidate.identity
    const { operationKind } = candidate.plan

    const satisfiedOperationKind = membershipOperationKindFromLocus(locus)
    if (satisfiedOperationKind === undefined) {
        // heldByOtherCharacter / withinObject: not closed-world atomic in v1
        return {
            verdict: 'defer',
            decidable: false,
            reason: objectManipulationErrorMessages.unimplementedAtomicOperation,
        }
    }

    if (satisfiedOperationKind !== operationKind) {
        return {
            verdict: 'illegal',
            decidable: true,
            reason: locus.kind === 'room'
                ? objectManipulationErrorMessages.notCarryingObject
                : objectManipulationErrorMessages.alreadyHoldingObject,
        }
    }

    return escalateExitEdgeIfNeeded(candidate.identity.objectId, context)
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
