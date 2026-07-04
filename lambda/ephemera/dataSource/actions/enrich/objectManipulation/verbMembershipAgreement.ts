import type { ManipulationVerbClass } from '../../baseClasses'
import type { ComplexityPreGateOutcome } from './complexityPreGates'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

export const AGREEMENT_FAILURE_CONFIDENCE_CAP = 0.5

export function agreementFailureConfidence(intentConfidence: number): number {
    return Math.min(intentConfidence, AGREEMENT_FAILURE_CONFIDENCE_CAP)
}

export type VerbMembershipAgreementOutcome =
    | { type: 'agreed'; operationKind: 'takeHold' | 'drop' }
    | { type: 'disagreement'; errorMessage: string }

export function evaluateVerbMembershipAgreement(
    verbClass: ManipulationVerbClass,
    preGateOutcome: Extract<ComplexityPreGateOutcome, { type: 'atomic' }>
): VerbMembershipAgreementOutcome {
    const { operationKind } = preGateOutcome
    if (verbClass === 'release' && operationKind === 'takeHold') {
        return {
            type: 'disagreement',
            errorMessage: objectManipulationErrorMessages.notCarryingObject,
        }
    }
    if (verbClass === 'acquire' && operationKind === 'drop') {
        return {
            type: 'disagreement',
            errorMessage: objectManipulationErrorMessages.alreadyHoldingObject,
        }
    }
    return { type: 'agreed', operationKind }
}
