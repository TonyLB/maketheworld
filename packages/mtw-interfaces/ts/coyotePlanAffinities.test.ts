import {
    isAcmeOrderEnrichModelLine,
    normalizeAcmeOrderEnrichLine,
    normalizeAcmeOrderEnrichResponse,
    isCoyoteAffinityPossibility,
    isAffordanceProvidedRef,
    isCoyoteTropeAffinity,
} from './coyotePlanAffinities'

describe('isCoyoteAffinityPossibility', () => {
    it('accepts known roles and aptness in range', () => {
        expect(isCoyoteAffinityPossibility({ role: 'terminal', aptness: 0.5 })).toBe(true)
        expect(isCoyoteAffinityPossibility({ role: 'connect-props', aptness: 0.7 })).toBe(true)
    })

    it('rejects unknown roles', () => {
        expect(isCoyoteAffinityPossibility({ role: 'wizard', aptness: 0.5 })).toBe(false)
    })
})

describe('isAcmeOrderEnrichModelLine', () => {
    it('accepts valid trope-first line', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: true,
                name: 'anvil',
                stableKey: 'anvil',
                tropeAffinities: [{ trope: 'Finishing Move', aptness: 'High', narrowing: 'drop payload' }],
            })
        ).toBe(true)
    })

    it('accepts invalid catalog line without legacy affinities field', () => {
        expect(
            isAcmeOrderEnrichModelLine({
                valid: false,
                name: 'moon',
                errorType: 'Not a thing',
            })
        ).toBe(true)
    })
})

describe('normalizeAcmeOrderEnrichLine', () => {
    it('normalizes empty trope list to tropeAffinitiesFailed', () => {
        expect(
            normalizeAcmeOrderEnrichLine({
                valid: true,
                name: 'rope',
                stableKey: 'rope',
                tropeAffinities: [],
            }, 'fallback')
        ).toEqual({
            valid: true,
            name: 'rope',
            stableKey: 'rope',
            tropeAffinities: [],
            tropeAffinitiesFailed: true,
        })
    })
})

describe('normalizeAcmeOrderEnrichResponse', () => {
    it('creates synthetic trope-failure line when lines missing', () => {
        expect(normalizeAcmeOrderEnrichResponse({ lines: 'bad' })).toEqual({
            lines: [{
                valid: true,
                name: 'order',
                stableKey: 'order',
                tropeAffinities: [],
                tropeAffinitiesFailed: true,
            }],
        })
    })
})

describe('isAffordanceProvidedRef', () => {
    it('accepts a row with object, omitted intended, and a single CoyoteTrope role', () => {
        expect(
            isAffordanceProvidedRef({
                object: 'spring-loaded crate',
                roles: ['Contraption'],
            })
        ).toBe(true)
    })

    it('accepts a row with intended: true', () => {
        expect(
            isAffordanceProvidedRef({
                object: 'spring-loaded crate',
                intended: true,
                roles: ['Contraption', 'Finishing Move'],
            })
        ).toBe(true)
    })

    it('rejects malformed intended values', () => {
        expect(
            isAffordanceProvidedRef({
                object: 'crate',
                intended: false,
                roles: ['Contraption'],
            })
        ).toBe(false)
        expect(
            isAffordanceProvidedRef({
                object: 'crate',
                intended: 'true',
                roles: ['Contraption'],
            })
        ).toBe(false)
        expect(
            isAffordanceProvidedRef({
                object: 'crate',
                intended: 1,
                roles: ['Contraption'],
            })
        ).toBe(false)
    })

    it('rejects empty roles array', () => {
        expect(
            isAffordanceProvidedRef({
                object: 'crate',
                roles: [],
            })
        ).toBe(false)
    })

    it('rejects roles array containing a non-CoyoteTrope value', () => {
        expect(
            isAffordanceProvidedRef({
                object: 'crate',
                roles: ['Contraption', 'wizard'],
            })
        ).toBe(false)
    })

    it('rejects non-string object values', () => {
        expect(
            isAffordanceProvidedRef({
                object: 5,
                roles: ['Contraption'],
            })
        ).toBe(false)
        expect(
            isAffordanceProvidedRef({
                object: null,
                roles: ['Contraption'],
            })
        ).toBe(false)
        expect(
            isAffordanceProvidedRef({
                roles: ['Contraption'],
            })
        ).toBe(false)
    })

    it('rejects empty or whitespace-only object strings', () => {
        expect(
            isAffordanceProvidedRef({
                object: '',
                roles: ['Contraption'],
            })
        ).toBe(false)
        expect(
            isAffordanceProvidedRef({
                object: '   ',
                roles: ['Contraption'],
            })
        ).toBe(false)
    })
})

describe('isCoyoteTropeAffinity', () => {
    const baseAffinity = {
        trope: 'Contraption' as const,
        aptness: 'High' as const,
        narrowing: 'rig the crate to spring',
    }

    it('accepts a row without affordancesProvided (regression)', () => {
        expect(isCoyoteTropeAffinity({ ...baseAffinity })).toBe(true)
    })

    it('accepts a row with valid affordancesProvided', () => {
        expect(
            isCoyoteTropeAffinity({
                ...baseAffinity,
                affordancesProvided: [
                    { object: 'spring-loaded crate', intended: true, roles: ['Contraption'] },
                    { object: 'tripwire', roles: ['Contraption'] },
                ],
            })
        ).toBe(true)
    })

    it('accepts a row with both environmentAffordances and affordancesProvided populated', () => {
        expect(
            isCoyoteTropeAffinity({
                ...baseAffinity,
                environmentAffordances: [
                    { object: 'boulder', roles: ['Finishing Move'] },
                ],
                affordancesProvided: [
                    { object: 'spring-loaded crate', roles: ['Contraption'] },
                ],
            })
        ).toBe(true)
    })

    it('rejects affordancesProvided that is not an array', () => {
        expect(
            isCoyoteTropeAffinity({
                ...baseAffinity,
                affordancesProvided: { object: 'crate', roles: ['Contraption'] },
            })
        ).toBe(false)
    })

    it('rejects affordancesProvided arrays containing a malformed entry (malformed intended)', () => {
        expect(
            isCoyoteTropeAffinity({
                ...baseAffinity,
                affordancesProvided: [
                    { object: 'crate', intended: 'true', roles: ['Contraption'] },
                ],
            })
        ).toBe(false)
    })

    it('rejects affordancesProvided arrays containing a malformed entry (empty roles)', () => {
        expect(
            isCoyoteTropeAffinity({
                ...baseAffinity,
                affordancesProvided: [
                    { object: 'crate', roles: [] },
                ],
            })
        ).toBe(false)
    })

    it('rejects affordancesProvided arrays containing a malformed entry (non-string object)', () => {
        expect(
            isCoyoteTropeAffinity({
                ...baseAffinity,
                affordancesProvided: [
                    { object: 7, roles: ['Contraption'] },
                ],
            })
        ).toBe(false)
    })
})
