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

    it('select surfaces the empty-candidates error via selectPlanTuple', () => {
        expect(selectJointFallbackTuple()).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        })
    })
})
