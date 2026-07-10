import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { identityPlanCandidateFromSpan } from './identityPlanCandidate'
import { T_JOINT_ABS, T_JOINT_ABS_UNARY, T_JOINT_MARGIN } from './embeddingMatch/thresholds'
import { selectIdentityPlanTuple } from './selectIdentityPlanTuple'
import type { ObjectSpanCandidate } from './spanResolution'
import { objectManipulationErrorMessages } from './resolveObjectSpan'

const bagId = 'OBJECT#Bag' as EphemeraObjectId
const satchelId = 'OBJECT#Satchel' as EphemeraObjectId
const broomId = 'OBJECT#Broom' as EphemeraObjectId
const mopId = 'OBJECT#Mop' as EphemeraObjectId

const candidate = (
    id: EphemeraObjectId,
    label: string,
    jointRelevance: number,
    locus: ObjectSpanCandidate['locus'],
    marginToRunnerUp?: number
): ObjectSpanCandidate => ({
    id,
    label,
    jointRelevance,
    marginToRunnerUp,
    sourceTags: ['lexical', 'embedding'],
    locus,
})

describe('selectIdentityPlanTuple', () => {
    it('illegal-if-wrong: drop bag selects held satchel over room bag', () => {
        const roomBag = identityPlanCandidateFromSpan(
            candidate(bagId, 'bag', 0.7, { kind: 'room' }),
            'drop'
        )
        const heldSatchel = identityPlanCandidateFromSpan(
            candidate(satchelId, 'satchel', 0.55, { kind: 'heldByActor' }),
            'drop'
        )

        const result = selectIdentityPlanTuple({
            candidates: [roomBag, heldSatchel],
            commandSpan: 'bag',
        })

        expect(result.verdict).toBe('resolved')
        if (result.verdict === 'resolved') {
            expect(result.candidate.identity.objectId).toBe(satchelId)
            expect(result.candidate.plan.operationKind).toBe('drop')
        }
    })

    it('thin margin among legal survivors -> consult', () => {
        const broom = identityPlanCandidateFromSpan(
            candidate(broomId, 'broom', T_JOINT_ABS + 0.05, { kind: 'room' }, T_JOINT_MARGIN - 0.01),
            'takeHold'
        )
        const mop = identityPlanCandidateFromSpan(
            candidate(mopId, 'mop', T_JOINT_ABS + 0.02, { kind: 'room' }),
            'takeHold'
        )

        const result = selectIdentityPlanTuple({
            candidates: [broom, mop],
            commandSpan: 'sweeping tool',
        })

        expect(result.verdict).toBe('consult')
        if (result.verdict === 'consult') {
            expect(result.alternatives).toHaveLength(2)
            expect(result.alternatives.map((a) => a.objectId)).toEqual([broomId, mopId])
        }
    })

    it('absent-object grey band below floor -> noMatch error (not consult)', () => {
        const anvil = identityPlanCandidateFromSpan(
            candidate(
                'OBJECT#Anvil' as EphemeraObjectId,
                'anvil',
                T_JOINT_ABS - 0.05,
                { kind: 'room' }
            ),
            'takeHold'
        )

        const result = selectIdentityPlanTuple({
            candidates: [anvil],
            commandSpan: 'sword',
        })

        expect(result).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.noMatch,
        })
    })

    it('auto-resolves exact / high-margin unary above unary floor', () => {
        const broom = identityPlanCandidateFromSpan(
            candidate(broomId, 'broom', 1, { kind: 'room' }),
            'takeHold'
        )
        broom.identity = { ...broom.identity, sourceTags: ['exact'] }

        const result = selectIdentityPlanTuple({ candidates: [broom] })
        expect(result.verdict).toBe('resolved')
    })

    it('uses unary absolute floor for single legal survivor', () => {
        const below = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', T_JOINT_ABS_UNARY - 0.01, { kind: 'room' }),
                    'takeHold'
                ),
            ],
        })
        expect(below.verdict).toBe('error')

        const above = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', T_JOINT_ABS_UNARY, { kind: 'room' }),
                    'takeHold'
                ),
            ],
        })
        expect(above.verdict).toBe('resolved')
    })

    it('returns illegal reason when all candidates illegal', () => {
        const result = selectIdentityPlanTuple({
            candidates: [
                identityPlanCandidateFromSpan(
                    candidate(broomId, 'broom', 0.9, { kind: 'room' }),
                    'drop'
                ),
            ],
        })
        expect(result).toEqual({
            verdict: 'error',
            reason: objectManipulationErrorMessages.notCarryingObject,
        })
    })
})
