import {
    isAcmeOrderEnrichModelLine,
    normalizeAcmeOrderEnrichLine,
    normalizeAcmeOrderEnrichResponse,
    isCoyoteAffinityPossibility,
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
