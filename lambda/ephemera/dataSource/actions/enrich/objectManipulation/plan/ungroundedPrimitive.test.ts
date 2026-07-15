import {
    actingCharacterRef,
    currentHostRef,
    objectSpanRef,
    type Assertion,
    type Change,
} from './ungroundedPrimitive'

describe('Referent constructors', () => {
    it('builds an objectSpan referent', () => {
        expect(objectSpanRef('bag')).toEqual({ referentType: 'objectSpan', span: 'bag' })
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
            relationKind: 'On',
        }
        expect(change.primitive).toBe('dissolveRelation')
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

    it('accepts a sameHost assertion (BD-15/16)', () => {
        const assertion: Assertion = {
            kind: 'assertion',
            predicate: 'sameHost',
            subject: objectSpanRef('tray'),
            object: objectSpanRef('table'),
            negate: false,
        }
        expect(assertion.predicate).toBe('sameHost')
    })
})
