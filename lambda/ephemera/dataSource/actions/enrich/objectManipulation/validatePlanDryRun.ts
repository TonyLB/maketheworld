import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraPositionGraph } from '../../../positions/positionGraph'
import { evaluateRelationalLegality } from './evaluateRelationalLegality'
import type {
    IdentityPlanCandidate,
    RelationalIdentityPlanCandidate,
} from './identityPlanCandidate'
import { objectTouchesExitEdgeOnGraph } from './membershipObservation'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export type DryRunVerdict = 'legal' | 'defer' | 'illegal'

export type DryRunOutcome = {
    verdict: DryRunVerdict
    /** False when an LLM validator would be required (Custom / unmodeled). */
    decidable: boolean
    reason?: string
    /**
     * Membership-only: the carry-closed transfer set (BD-13), when a `legal` verdict came from
     * `sandboxMembershipDryRun`'s Expansion-mediated dry run. Absent for relational dry runs and
     * for any non-`legal` verdict.
     */
    objectIds?: EphemeraObjectId[]
    /**
     * Relational-only: the host actually selected among candidate hosts (Room or
     * Character) when the verdict is `legal` (BD-15/16). Absent for membership dry
     * runs and for any non-`legal` verdict.
     */
    hostId?: EphemeraMembershipHostId
}

export type ValidateMembershipPlanContext = {
    /** When present, exit-edge contact escalates an otherwise-legal atomic to defer. */
    positionGraph?: EphemeraPositionGraph
    actorCharacterId?: EphemeraCharacterId
}

export type ValidateRelationalPlanContext = {
    positionGraph: EphemeraPositionGraph
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

/**
 * Single-step relational dry-run (FT-3.3). Wraps evaluateRelationalLegality;
 * allow -> legal, failures -> illegal (no Consult from legality).
 */
export function validateRelationalPlanDryRun(
    candidate: RelationalIdentityPlanCandidate,
    context: ValidateRelationalPlanContext
): DryRunOutcome {
    const legality = evaluateRelationalLegality({
        operationKind: candidate.plan.operationKind,
        subjectId: candidate.subject.objectId,
        targetId: candidate.target.objectId,
        normalizedRelation: candidate.plan.relation,
        graph: context.positionGraph,
    })
    if (legality.type === 'allow') {
        return { verdict: 'legal', decidable: true }
    }
    return {
        verdict: 'illegal',
        decidable: true,
        reason: legality.errorMessage,
    }
}
