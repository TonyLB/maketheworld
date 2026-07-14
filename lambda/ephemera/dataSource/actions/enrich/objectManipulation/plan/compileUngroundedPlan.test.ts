import type { MembershipManipulationFrame } from '../membershipFrame'
import type { ManipulationFrame } from '../manipulationFrame'

import { compileMembershipUngroundedPlan, compileRelationalUngroundedPlan } from './compileUngroundedPlan'
import { actingCharacterRef, currentHostRef, objectSpanRef } from './ungroundedPrimitive'

const membershipFrame = (overrides: Partial<MembershipManipulationFrame>): MembershipManipulationFrame => ({
    command: 'take the golf club',
    rawObjectSpans: ['golf club'],
    verbClass: 'acquire',
    ...overrides,
})

const relationalFrame = (overrides: Partial<ManipulationFrame>): ManipulationFrame => ({
    command: 'put the broom on the table',
    subjectSpan: 'broom',
    targetSpan: 'table',
    relationSpan: 'on',
    operationKind: 'establishRelation',
    rawObjectSpans: ['broom', 'table'],
    ...overrides,
})

describe('compileMembershipUngroundedPlan', () => {
    it('compiles an acquire verb to transferMembership from the object\'s current host to the acting character', () => {
        const result = compileMembershipUngroundedPlan(membershipFrame({ verbClass: 'acquire' }))
        expect(result).toEqual({
            type: 'success',
            steps: [{
                kind: 'change',
                primitive: 'transferMembership',
                object: objectSpanRef('golf club'),
                from: currentHostRef(objectSpanRef('golf club')),
                to: actingCharacterRef,
            }],
        })
    })

    it('compiles a release verb to transferMembership from the acting character to their current host', () => {
        const result = compileMembershipUngroundedPlan(membershipFrame({ verbClass: 'release' }))
        expect(result).toEqual({
            type: 'success',
            steps: [{
                kind: 'change',
                primitive: 'transferMembership',
                object: objectSpanRef('golf club'),
                from: actingCharacterRef,
                to: currentHostRef(actingCharacterRef),
            }],
        })
    })

    it('returns multiObject when more than one span is present', () => {
        const result = compileMembershipUngroundedPlan(membershipFrame({ rawObjectSpans: ['broom', 'mop'] }))
        expect(result).toEqual({ type: 'multiObject' })
    })

    it('returns multiObject when no span is present', () => {
        const result = compileMembershipUngroundedPlan(membershipFrame({ rawObjectSpans: [] }))
        expect(result).toEqual({ type: 'multiObject' })
    })
})

describe('compileRelationalUngroundedPlan', () => {
    it('compiles an establishRelation frame with an enum relation kind', () => {
        const result = compileRelationalUngroundedPlan(relationalFrame({ operationKind: 'establishRelation', relationSpan: 'on' }))
        expect(result).toEqual({
            type: 'success',
            steps: [{
                kind: 'change',
                primitive: 'establishRelation',
                subject: objectSpanRef('broom'),
                target: objectSpanRef('table'),
                relationKind: 'On',
            }],
        })
    })

    it('compiles a dissolveRelation frame', () => {
        const result = compileRelationalUngroundedPlan(relationalFrame({
            operationKind: 'dissolveRelation',
            subjectSpan: 'rope',
            targetSpan: 'crate',
            relationSpan: 'under',
        }))
        expect(result).toEqual({
            type: 'success',
            steps: [{
                kind: 'change',
                primitive: 'dissolveRelation',
                subject: objectSpanRef('rope'),
                target: objectSpanRef('crate'),
                relationKind: 'Under',
            }],
        })
    })

    it('preserves a custom relation label', () => {
        const result = compileRelationalUngroundedPlan(relationalFrame({
            subjectSpan: 'cord',
            targetSpan: 'crate',
            relationSpan: 'tied around',
        }))
        expect(result).toEqual({
            type: 'success',
            steps: [{
                kind: 'change',
                primitive: 'establishRelation',
                subject: objectSpanRef('cord'),
                target: objectSpanRef('crate'),
                relationKind: 'Custom',
                relationLabel: 'tied around',
            }],
        })
    })

    it('returns nestingDefer for containment language', () => {
        const result = compileRelationalUngroundedPlan(relationalFrame({
            subjectSpan: 'coin',
            targetSpan: 'jar',
            relationSpan: 'in',
        }))
        expect(result).toEqual({ type: 'nestingDefer' })
    })
})
