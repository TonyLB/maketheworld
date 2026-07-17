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
 * Joint fallback (BD-19 (1)): both Identity and Plan failed deterministically ---
 * one LLM call produces both sides of a candidate in one shot, so there is only
 * one self-reported confidence per candidate, not two sources to combine.
 * `combineConfidenceNaive` is deliberately not used here (see BD-19 (3)):
 * `confidence` is the LLM's own reported score directly.
 */
export type JointFallbackCandidate = {
    identity: IdentityPlanIdentity
    plan: RelationalPlanStub | MembershipPlanStub
    confidence: number
}

export type JointFallbackInvokeResult =
    | { type: 'success'; candidates: readonly JointFallbackCandidate[] }
    | { type: 'error'; errorMessage: string }

/**
 * Stub (BD-19 build sequence, step 2): no Bedrock call yet --- always declines.
 * Steps 3-5 replace this body with a real invoke + parse, without touching
 * `proposeJointFallbackTuples`/`selectJointFallbackTuple` below.
 */
export function invokeJointFallback(): JointFallbackInvokeResult {
    return {
        type: 'error',
        errorMessage: objectManipulationErrorMessages.jointFallbackNotYetImplemented,
    }
}

export function proposeJointFallbackTuples(): readonly JointFallbackCandidate[] {
    const result = invokeJointFallback()
    return result.type === 'success' ? result.candidates : []
}

const jointFallbackDryRun = (): DryRunOutcome => ({
    verdict: 'illegal',
    decidable: true,
    reason: objectManipulationErrorMessages.jointFallbackNotYetImplemented,
})

const jointFallbackConsultAlternative = (
    candidate: JointFallbackCandidate
): SpanResolutionConsultAlternative => ({
    objectId: candidate.identity.objectId,
    label: candidate.identity.label,
    proposedCommand: candidate.identity.label,
})

export function selectJointFallbackTuple(): SelectPlanTupleResult<JointFallbackCandidate> {
    const input: SelectPlanTupleInput<JointFallbackCandidate> = {
        candidates: proposeJointFallbackTuples(),
        getConfidence: (candidate) => candidate.confidence,
        dryRun: jointFallbackDryRun,
        toConsultAlternative: jointFallbackConsultAlternative,
    }
    return selectPlanTuple(input)
}
