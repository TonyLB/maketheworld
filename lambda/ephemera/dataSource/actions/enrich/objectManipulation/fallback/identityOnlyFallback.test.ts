import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import {
    invokeIdentityOnlyFallback,
    proposeIdentityOnlyFallbackTuples,
    selectIdentityOnlyFallbackTuple,
} from './identityOnlyFallback'

describe('identityOnlyFallback (stub)', () => {
    it('invoke declines with the not-yet-implemented message', () => {
        expect(invokeIdentityOnlyFallback()).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackNotYetImplemented,
        })
    })

    it('propose returns no candidates', () => {
        expect(proposeIdentityOnlyFallbackTuples()).toEqual([])
    })

    it('select surfaces the empty-candidates error via selectPlanTuple', () => {
        expect(selectIdentityOnlyFallbackTuple()).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        })
    })
})
