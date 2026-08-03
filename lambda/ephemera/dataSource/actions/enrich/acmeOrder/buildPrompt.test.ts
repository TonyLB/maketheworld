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
        expect(invariantPrefix).toContain('affordancesProvided')
        expect(invariantPrefix).toContain('"intended": true')
        expect(invariantPrefix).toContain('Scene Dressing')
        expect(invariantPrefix).toContain('narrative association')
        expect(invariantPrefix).toContain('narrowing` POV rule (causal tropes only)')
        expect(invariantPrefix).toContain('On **`Scene Dressing`** trope entries, **omit** **`environmentAffordances`**')
        expect(invariantPrefix).toContain('On **`Scene Dressing`** trope entries, **omit** **`affordancesProvided`**')
        expect(invariantPrefix).toContain('workshop-glue')
        expect(invariantPrefix).toContain('portable-hole')
        expect(invariantPrefix).toContain('Iconic genre examples')
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

    it('embeds authoritative product spans block in dynamicSuffix when intentRawOrders is provided', () => {
        const { dynamicSuffix } = buildParseAcmeOrderEnrichPrompt('order glue trap', {
            intentRawOrders: ['glue trap'],
        })
        expect(dynamicSuffix).toContain('## Product spans to validate')
        expect(dynamicSuffix).toContain('authoritative')
        expect(dynamicSuffix).toContain('- glue trap')
        expect(dynamicSuffix).toContain('order glue trap')
    })

    it('omits product spans section when intentRawOrders is empty or only whitespace', () => {
        expect(buildParseAcmeOrderEnrichPrompt('order rope', { intentRawOrders: [] }).dynamicSuffix)
            .not.toContain('## Product spans to validate')
        expect(buildParseAcmeOrderEnrichPrompt('order rope', { intentRawOrders: ['  ', ''] }).dynamicSuffix)
            .not.toContain('## Product spans to validate')
    })

    it('omits iconic few-shot when includeIconicFewShots is false', () => {
        const { invariantPrefix } = buildParseAcmeOrderEnrichPrompt('order rope', {
            includeIconicFewShots: false,
        })
        expect(invariantPrefix).toContain('beehive')
        expect(invariantPrefix).toContain('workshop-glue')
        expect(invariantPrefix).not.toContain('Iconic genre examples')
        expect(invariantPrefix).not.toContain('portable-hole')
    })

    it('gives every valid few-shot line a defaultSituation, so omission is never modeled', () => {
        // Regression: the iconic few-shot carried a verbatim `"name": "Rocket Skates"` line with no
        // `defaultSituation`, and `order rocket skates` reliably came back with no prose (twice) while
        // differently-phrased orders got prose. Few-shot shape beats prose instruction, so any valid
        // example line lacking this field teaches the model that skipping it is acceptable.
        const { invariantPrefix } = buildParseAcmeOrderEnrichPrompt('order rope')
        const validLineCount = (invariantPrefix.match(/"valid":\s*true/g) ?? []).length
        const defaultSituationCount = (invariantPrefix.match(/"defaultSituation":/g) ?? []).length
        expect(validLineCount).toBeGreaterThan(0)
        expect(defaultSituationCount).toBe(validLineCount)
    })

    it('tells the model that matching a calibration example does not excuse skipping prose', () => {
        const { invariantPrefix } = buildParseAcmeOrderEnrichPrompt('order rope')
        expect(invariantPrefix).toContain('required on every')
        expect(invariantPrefix).toContain('matching one never licenses reusing its prose')
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
