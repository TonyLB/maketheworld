import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import {
    actingCharacterRef,
    currentHostRef,
    derivedReferentKey,
    objectSpanRef,
    viewMintedByExtend,
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

describe('derivedReferentKey', () => {
    it('keys actingCharacter structurally', () => {
        expect(derivedReferentKey(actingCharacterRef)).toBe('actingCharacter')
    })

    it('keys currentHost(actingCharacter) by nesting', () => {
        expect(derivedReferentKey(currentHostRef(actingCharacterRef))).toBe('currentHost(actingCharacter)')
    })

    it('keys currentHost(objectSpan) by its stableRefKey, even though no live producer nests one today', () => {
        expect(derivedReferentKey(currentHostRef(objectSpanRef('rope', 'ropeRef')))).toBe('currentHost(span:ropeRef)')
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

describe('viewMintedByExtend', () => {
    const extend: Change = { kind: 'change', primitive: 'extend', object: objectSpanRef('rope'), presenceUuid: 'new-end' }
    const withView = (...uuids: string[]) => ({ ...objectSpanRef('rope'), view: uuids.map((uuid) => PresenceKey(uuid)) } as ReturnType<typeof objectSpanRef>)

    it('is true when the view names the binding an extend step mints', () => {
        expect(viewMintedByExtend(withView('new-end'), [extend])).toBe(true)
    })

    it('is false when the view names a different binding than the extend mints', () => {
        expect(viewMintedByExtend(withView('existing'), [extend])).toBe(false)
    })

    it('is false when the attempt has no extend step', () => {
        expect(viewMintedByExtend(withView('new-end'), [])).toBe(false)
    })

    it('is false for a referent with no view (the whole object)', () => {
        expect(viewMintedByExtend(objectSpanRef('rope'), [extend])).toBe(false)
    })
})
