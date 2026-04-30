import { buildParseAcmeOrderEnrichPrompt } from './buildPrompt'

describe('buildParseAcmeOrderEnrichPrompt', () => {
    it('returns prompt sections with stable top-level anchors', () => {
        const { invariantPrefix, dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('order rope')
        // Spot-check only: keep these invariantPrefix checks intentionally sparse.
        // They may be modified when core prompt structure changes, but should not
        // be expanded by default for routine instruction copy edits.
        expect(invariantPrefix).toContain('two required parts in fixed order')
        expect(invariantPrefix).toContain('JSON handoff')
        expect(invariantPrefix).toContain('finishing-mechanisms')
        expect(dynamicSuffix).toContain('order rope')
        expect(dynamicSuffix).toContain('Player command')
        expect(dynamicSuffix).toContain('Coyote-wide stable keys already in use')
        expect(dynamicSuffix).toContain('(none)')
    })

    it('debugRationale flag is inert and returns the same compact prompt', () => {
        const compact = buildParseAcmeOrderEnrichPrompt('order rope')
        const verboseFlag = buildParseAcmeOrderEnrichPrompt('order rope', {
            debugRationale: true,
        })
        expect(verboseFlag.invariantPrefix).toEqual(compact.invariantPrefix)
        expect(verboseFlag.dynamicSuffix).toEqual(compact.dynamicSuffix)
        expect(verboseFlag.invariantPrefix).not.toContain('Classify order type (Chain-of-reason markdown)')
        expect(verboseFlag.invariantPrefix).not.toContain('one section or bullet block')
        expect(verboseFlag.dynamicSuffix).toContain('order rope')
    })

    it('normalizes command whitespace in dynamicSuffix', () => {
        const { dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('  order glue and springs   ')
        expect(dynamicSuffix).toContain('order glue and springs')
        expect(dynamicSuffix).not.toContain('  order glue and springs   ')
    })

    it('uses explicit empty-command placeholder when command trims empty', () => {
        const { dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('   ')
        expect(dynamicSuffix).toContain('(empty command)')
    })

    it('lists occupied stable keys in dynamicSuffix after dedupe and sort', () => {
        const { dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('buy widget', {
            occupiedStableKeys: ['zebra', 'alpha', 'alpha', 'beta'],
        })
        expect(dynamicSuffix).toContain('- alpha')
        expect(dynamicSuffix).toContain('- beta')
        expect(dynamicSuffix).toContain('- zebra')
        expect(dynamicSuffix.indexOf('- alpha')).toBeLessThan(dynamicSuffix.indexOf('- beta'))
        expect(dynamicSuffix.indexOf('- beta')).toBeLessThan(dynamicSuffix.indexOf('- zebra'))
    })

    it('trims and drops empty occupied stable keys before dedupe + sort', () => {
        const { dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('buy widget', {
            occupiedStableKeys: [' zebra ', '', '  ', 'alpha', 'alpha '],
        })
        expect(dynamicSuffix).toContain('- alpha')
        expect(dynamicSuffix).toContain('- zebra')
        expect((dynamicSuffix.match(/\n- /g) ?? []).length).toBe(2)
    })
})
