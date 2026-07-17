import { combineConfidenceNaive } from '../confidenceCombine'
import type {
    IdentityPlanIdentity,
    MembershipPlanStub,
    RelationalPlanStub,
} from '../identityPlanCandidate'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import {
    selectPlanTuple,
    type SelectPlanTupleInput,
    type SelectPlanTupleResult,
} from '../selectIdentityPlanTuple'
import type { SpanResolutionConsultAlternative } from '../spanResolution'
import type { DryRunOutcome } from '../validatePlanDryRun'

/**
 * Plan-only fallback (BD-19 (1)): Identity already succeeded deterministically,
 * as a shortlist --- this LLM proposes N ranked plan interpretations against it.
 * The one fallback case BD-19 (3) actually motivated `combineConfidenceNaive`
 * for: an identity shortlist entry's `jointRelevance` and the LLM's own reported
 * plan confidence are different kinds of measurement, cross-producted (BD-19
 * (2)), so `confidence` here is a combined value, precomputed at construction ---
 * mirroring how `RelationalIdentityPlanCandidate.confidence` is precomputed
 * today rather than derived lazily.
 */
export type PlanOnlyFallbackCandidate = {
    identity: IdentityPlanIdentity
    plan: RelationalPlanStub | MembershipPlanStub
    llmPlanConfidence: number
    /** combineConfidenceNaive(identity.jointRelevance, llmPlanConfidence) --- placeholder, see BD-19 (3). */
    confidence: number
}

export function planOnlyFallbackCandidate(
    identity: IdentityPlanIdentity,
    plan: RelationalPlanStub | MembershipPlanStub,
    llmPlanConfidence: number
): PlanOnlyFallbackCandidate {
    return {
        identity,
        plan,
        llmPlanConfidence,
        confidence: combineConfidenceNaive(identity.jointRelevance, llmPlanConfidence),
    }
}

export type PlanOnlyFallbackInvokeResult =
    | { type: 'success'; candidates: readonly PlanOnlyFallbackCandidate[] }
    | { type: 'error'; errorMessage: string }

/**
 * Stub (BD-19 build sequence, step 2): no Bedrock call yet --- always declines.
 * Steps 3-5 replace this body with a real invoke + parse, without touching
 * `proposePlanOnlyFallbackTuples`/`selectPlanOnlyFallbackTuple` below.
 */
export function invokePlanOnlyFallback(): PlanOnlyFallbackInvokeResult {
    return {
        type: 'error',
        errorMessage: objectManipulationErrorMessages.planOnlyFallbackNotYetImplemented,
    }
}

export function proposePlanOnlyFallbackTuples(): readonly PlanOnlyFallbackCandidate[] {
    const result = invokePlanOnlyFallback()
    return result.type === 'success' ? result.candidates : []
}

const planOnlyFallbackDryRun = (): DryRunOutcome => ({
    verdict: 'illegal',
    decidable: true,
    reason: objectManipulationErrorMessages.planOnlyFallbackNotYetImplemented,
})

const planOnlyFallbackConsultAlternative = (
    candidate: PlanOnlyFallbackCandidate
): SpanResolutionConsultAlternative => ({
    objectId: candidate.identity.objectId,
    label: candidate.identity.label,
    proposedCommand: candidate.identity.label,
})

export function selectPlanOnlyFallbackTuple(): SelectPlanTupleResult<PlanOnlyFallbackCandidate> {
    const input: SelectPlanTupleInput<PlanOnlyFallbackCandidate> = {
        candidates: proposePlanOnlyFallbackTuples(),
        getConfidence: (candidate) => candidate.confidence,
        dryRun: planOnlyFallbackDryRun,
        toConsultAlternative: planOnlyFallbackConsultAlternative,
    }
    return selectPlanTuple(input)
}
