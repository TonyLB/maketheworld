import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { EphemeraPositionGraph } from '../../../positions/positionGraph'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'
import type { IdentityPlanCandidate } from './identityPlanCandidate'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type DryRunVerdict = 'legal' | 'defer' | 'illegal'

export type DryRunOutcome = {
    verdict: DryRunVerdict
    /** False when an LLM validator would be required (Custom / unmodeled). */
    decidable: boolean
    reason?: string
}

export type ValidateMembershipPlanContext = {
    /** When present, exit-edge contact escalates an otherwise-legal atomic to defer. */
    positionGraph?: EphemeraPositionGraph
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
        context.positionGraph !== undefined
        && objectTouchesExitEdgeOnGraph(context.positionGraph, objectId)
    ) {
        return {
            verdict: 'defer',
            decidable: true,
            reason: 'exitEdge',
        }
    }
    return { verdict: 'legal', decidable: true }
}
