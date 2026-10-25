import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import {
    invokeJointFallback,
    proposeJointFallbackTuples,
    selectJointFallbackTuple,
} from './jointFallback'

describe('jointFallback (stub)', () => {
    it('invoke declines with the not-yet-implemented message', () => {
        expect(invokeJointFallback()).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.jointFallbackNotYetImplemented,
        })
    })

    it('propose returns no candidates', () => {
        expect(proposeJointFallbackTuples()).toEqual([])
    })

    it('select abstains on empty candidates via selectPlanTuple', () => {
        expect(selectJointFallbackTuple()).toEqual({
            verdict: 'abstain',
            reason: objectManipulationErrorMessages.noCatalog,
        })
    })
})
