import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { IdentityPlanIdentity, MembershipPlanStub } from '../identityPlanCandidate'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import {
    invokePlanOnlyFallback,
    planOnlyFallbackCandidate,
    proposePlanOnlyFallbackTuples,
    selectPlanOnlyFallbackTuple,
} from './planOnlyFallback'

describe('planOnlyFallback (stub)', () => {
    it('invoke declines with the not-yet-implemented message', () => {
        expect(invokePlanOnlyFallback()).toEqual({
            type: 'error',
            errorMessage: objectManipulationErrorMessages.planOnlyFallbackNotYetImplemented,
        })
    })

    it('propose returns no candidates', () => {
        expect(proposePlanOnlyFallbackTuples()).toEqual([])
    })

    it('select surfaces the empty-candidates error via selectPlanTuple', () => {
        expect(selectPlanOnlyFallbackTuple()).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.noCatalog,
        })
    })

    it('planOnlyFallbackCandidate combines identity and LLM plan confidence via arithmetic mean', () => {
        const identity: IdentityPlanIdentity = {
            objectId: 'OBJECT#test' as EphemeraObjectId,
            label: 'test object',
            locus: { kind: 'room' },
            jointRelevance: 0.8,
            sourceTags: [],
        }
        const plan: MembershipPlanStub = { kind: 'transferMembership', operationKind: 'takeHold' }
        const candidate = planOnlyFallbackCandidate(identity, plan, 0.4)
        expect(candidate.confidence).toBeCloseTo(0.6)
    })
})
