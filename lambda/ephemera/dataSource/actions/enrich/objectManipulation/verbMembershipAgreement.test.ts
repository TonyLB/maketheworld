import {
    AGREEMENT_FAILURE_CONFIDENCE_CAP,
    agreementFailureConfidence,
    evaluateVerbMembershipAgreement,
} from './verbMembershipAgreement'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

describe('agreementFailureConfidence', () => {
    it('caps classify confidence at AGREEMENT_FAILURE_CONFIDENCE_CAP', () => {
        expect(agreementFailureConfidence(0.94)).toBe(AGREEMENT_FAILURE_CONFIDENCE_CAP)
        expect(agreementFailureConfidence(0.3)).toBe(0.3)
    })
})

describe('evaluateVerbMembershipAgreement', () => {
    it('agrees on acquire + takeHold', () => {
        expect(
            evaluateVerbMembershipAgreement('acquire', { type: 'atomic', operationKind: 'takeHold' })
        ).toEqual({ type: 'agreed', operationKind: 'takeHold' })
    })

    it('agrees on release + drop', () => {
        expect(
            evaluateVerbMembershipAgreement('release', { type: 'atomic', operationKind: 'drop' })
        ).toEqual({ type: 'agreed', operationKind: 'drop' })
    })

    it('returns notCarryingObject on release + takeHold', () => {
        expect(
            evaluateVerbMembershipAgreement('release', { type: 'atomic', operationKind: 'takeHold' })
        ).toEqual({
            type: 'disagreement',
            errorMessage: objectManipulationErrorMessages.notCarryingObject,
        })
    })

    it('returns alreadyHoldingObject on acquire + drop', () => {
        expect(
            evaluateVerbMembershipAgreement('acquire', { type: 'atomic', operationKind: 'drop' })
        ).toEqual({
            type: 'disagreement',
            errorMessage: objectManipulationErrorMessages.alreadyHoldingObject,
        })
    })
})
