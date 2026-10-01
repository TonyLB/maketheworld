import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    actingCharacterRef,
    currentHostRef,
    groundStepBySubstitution,
    objectSpanRef,
    type Assertion,
    type Change,
} from './planStep'

describe('Referent constructors', () => {
    it('builds an objectSpan referent', () => {
        expect(objectSpanRef('bag')).toEqual({ referentType: 'objectSpan', span: 'bag' })
    })

    it('builds an objectSpan referent with a stableRefKey when provided', () => {
        expect(objectSpanRef('bag', 'bagRef')).toEqual({
            referentType: 'objectSpan',
            span: 'bag',
            stableRefKey: 'bagRef',
        })
    })

    it('builds the actingCharacter referent', () => {
        expect(actingCharacterRef).toEqual({ referentType: 'actingCharacter' })
    })

    it('composes currentHost over actingCharacter to express "the room the actor is in"', () => {
        expect(currentHostRef(actingCharacterRef)).toEqual({
            referentType: 'currentHost',
            referentTarget: { referentType: 'actingCharacter' },
        })
    })

    it('composes currentHost over an objectSpan referent', () => {
        expect(currentHostRef(objectSpanRef('tray'))).toEqual({
            referentType: 'currentHost',
            referentTarget: { referentType: 'objectSpan', span: 'tray' },
        })
    })
})

describe('Change literal shapes', () => {
    it('accepts a transferMembership change', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('golf club'),
            from: currentHostRef(objectSpanRef('golf club')),
            to: actingCharacterRef,
        }
        expect(change.primitive).toBe('transferMembership')
    })

    it('accepts an establishRelation change with a custom relation label', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('cord'),
            target: objectSpanRef('crate'),
            host: currentHostRef(actingCharacterRef),
            relationKind: 'Custom',
            relationLabel: 'tied around',
        }
        expect(change.relationLabel).toBe('tied around')
    })

    it('accepts a dissolveRelation change', () => {
        const change: Change = {
            kind: 'change',
            primitive: 'dissolveRelation',
            subject: objectSpanRef('rope'),
            target: objectSpanRef('crate'),
            host: currentHostRef(actingCharacterRef),
            relationKind: 'On',
        }
        expect(change.primitive).toBe('dissolveRelation')
    })
})

describe('groundStepBySubstitution', () => {
    const ropeId = 'OBJECT#Rope' as EphemeraObjectId

    it('substitutes a transferMembership object referent whose stableRefKey is assigned', () => {
        const step: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('rope', 'primaryObject'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const grounded = groundStepBySubstitution(step, new Map([['primaryObject', ropeId]]))
        expect(grounded).toEqual({
            ...step,
            object: { ...objectSpanRef('rope', 'primaryObject'), groundedId: ropeId },
        })
    })

    it('leaves derived referents (no stableRefKey) and unassigned keys untouched', () => {
        const step: Change = {
            kind: 'change',
            primitive: 'transferMembership',
            object: objectSpanRef('rope', 'otherKey'),
            from: currentHostRef(actingCharacterRef),
            to: actingCharacterRef,
        }
        const grounded = groundStepBySubstitution(step, new Map([['primaryObject', ropeId]]))
        expect(grounded).toEqual(step)
    })

    it('substitutes subject/target referents on an establishRelation change', () => {
        const step: Change = {
            kind: 'change',
            primitive: 'establishRelation',
            subject: objectSpanRef('cord', 'subjectRef'),
            target: objectSpanRef('crate', 'targetRef'),
            host: currentHostRef(actingCharacterRef),
            relationKind: 'Custom',
            relationLabel: 'tied around',
        }
        const grounded = groundStepBySubstitution(step, new Map([['subjectRef', ropeId]]))
        expect(grounded).toEqual({
            ...step,
            subject: { ...objectSpanRef('cord', 'subjectRef'), groundedId: ropeId },
        })
    })
})

describe('Assertion literal shape', () => {
    it('accepts a negated containedBy assertion', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'containedBy',
            subject: objectSpanRef('golf club'),
            object: actingCharacterRef,
            negate: true,
        }
        expect(assertion.negate).toBe(true)
    })
})
