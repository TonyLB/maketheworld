import type { IdentityPlanCandidate } from '../identityPlanCandidate'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import {
    selectPlanTuple,
    type SelectPlanTupleInput,
    type SelectPlanTupleResult,
} from '../selectIdentityPlanTuple'
import type { SpanResolutionConsultAlternative } from '../spanResolution'
import type { DryRunOutcome } from '../validatePlanDryRun'

/**
 * Identity-only fallback (BD-19 (1)): Plan already succeeded deterministically ---
 * this LLM proposes N ranked identity candidates against that fixed plan. Reuses
 * `IdentityPlanCandidate` verbatim (BD-19 (2): no plan-side cross-product exists
 * here, so no combined-confidence field is needed --- `confidence` is just the
 * LLM's own reported identity score, same field identity always had).
 */
export type IdentityOnlyFallbackInvokeResult =
    | { type: 'success'; candidates: readonly IdentityPlanCandidate[] }
    | { type: 'error'; errorMessage: string }

/**
 * Stub (BD-19 build sequence, step 2): no Bedrock call yet --- always declines.
 * Steps 3-5 replace this body with a real invoke + parse, without touching
 * `proposeIdentityOnlyFallbackTuples`/`selectIdentityOnlyFallbackTuple` below.
 */
export function invokeIdentityOnlyFallback(): IdentityOnlyFallbackInvokeResult {
    return {
        type: 'error',
        errorMessage: objectManipulationErrorMessages.identityOnlyFallbackNotYetImplemented,
    }
}

export function proposeIdentityOnlyFallbackTuples(): readonly IdentityPlanCandidate[] {
    const result = invokeIdentityOnlyFallback()
    return result.type === 'success' ? result.candidates : []
}

const identityOnlyFallbackDryRun = (): DryRunOutcome => ({
    verdict: 'illegal',
    decidable: true,
    reason: objectManipulationErrorMessages.identityOnlyFallbackNotYetImplemented,
})

const identityOnlyFallbackConsultAlternative = (
    candidate: IdentityPlanCandidate
): SpanResolutionConsultAlternative => ({
    objectId: candidate.identity.objectId,
    label: candidate.identity.label,
    proposedCommand: candidate.identity.label,
})

export function selectIdentityOnlyFallbackTuple(): SelectPlanTupleResult<IdentityPlanCandidate> {
    const input: SelectPlanTupleInput<IdentityPlanCandidate> = {
        candidates: proposeIdentityOnlyFallbackTuples(),
        getConfidence: (candidate) => candidate.confidence,
        dryRun: identityOnlyFallbackDryRun,
        toConsultAlternative: identityOnlyFallbackConsultAlternative,
    }
    return selectPlanTuple(input)
}
