import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import {
    identityPlanCandidateFromSpan,
    membershipOperationKindFromLocus,
    membershipOperationKindFromVerbClass,
} from './identityPlanCandidate'
import type { ObjectSpanCandidate } from './spanResolution'
import { validateMembershipPlanDryRun } from './validatePlanDryRun'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId

const roomBag: ObjectSpanCandidate = {
    id: bagId,
    label: 'bag',
    jointRelevance: 0.7,
    sourceTags: ['lexical', 'embedding'],
    locus: { kind: 'room' },
}

const heldSatchel: ObjectSpanCandidate = {
    id: satchelId,
    label: 'satchel',
    jointRelevance: 0.65,
    sourceTags: ['lexical', 'embedding'],
    locus: { kind: 'heldByActor' },
}

describe('identityPlanCandidate helpers', () => {
    it('maps verbClass to membership operationKind', () => {
        expect(membershipOperationKindFromVerbClass('acquire')).toBe('takeHold')
        expect(membershipOperationKindFromVerbClass('release')).toBe('drop')
    })

    it('maps v1 locus to operationKind', () => {
        expect(membershipOperationKindFromLocus({ kind: 'room' })).toBe('takeHold')
        expect(membershipOperationKindFromLocus({ kind: 'heldByActor' })).toBe('drop')
        expect(membershipOperationKindFromLocus({
            kind: 'withinObject',
            hostId: bagId,
            hostLabel: 'bag',
        })).toBeUndefined()
    })
})

describe('validateMembershipPlanDryRun', () => {
    it('marks room + takeHold legal and room + drop illegal', () => {
        expect(validateMembershipPlanDryRun(
            identityPlanCandidateFromSpan(roomBag, 'takeHold')
        )).toEqual({ verdict: 'legal', decidable: true })

        expect(validateMembershipPlanDryRun(
            identityPlanCandidateFromSpan(roomBag, 'drop')
        )).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.notCarryingObject,
        })
    })

    it('marks held + drop legal and held + takeHold illegal', () => {
        expect(validateMembershipPlanDryRun(
            identityPlanCandidateFromSpan(heldSatchel, 'drop')
        )).toEqual({ verdict: 'legal', decidable: true })

        expect(validateMembershipPlanDryRun(
            identityPlanCandidateFromSpan(heldSatchel, 'takeHold')
        )).toEqual({
            verdict: 'illegal',
            decidable: true,
            reason: objectManipulationErrorMessages.alreadyHoldingObject,
        })
    })
})
