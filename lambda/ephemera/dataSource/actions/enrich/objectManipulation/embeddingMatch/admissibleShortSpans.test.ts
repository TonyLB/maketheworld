import {
    buildAdmissibleShortSpans,
    isLexicalChannelActive,
} from './admissibleShortSpans'
import { lexicalRelevance } from './lexicalRelevance'

describe('buildAdmissibleShortSpans', () => {
    it('admits whole short names and tokens shorter than S_min', () => {
        const admissible = buildAdmissibleShortSpans([
            { normalizedShortName: 'rusty ax' },
            { normalizedShortName: 'ax' },
        ])
        expect(admissible.has('ax')).toBe(true)
        expect(admissible.has('rusty ax')).toBe(false)
    })

    it('does not admit alpha-prefixes inside tokens', () => {
        const admissible = buildAdmissibleShortSpans([
            { normalizedShortName: 'rusty axe' },
        ])
        expect(admissible.has('ax')).toBe(false)
    })

    it('includes shared tokens from duplicate normalized shortNames', () => {
        const admissible = buildAdmissibleShortSpans([
            { normalizedShortName: 'red go' },
            { normalizedShortName: 'blue go' },
        ])
        expect(admissible.has('go')).toBe(true)
    })
})

describe('isLexicalChannelActive', () => {
    const catalogWithAx = buildAdmissibleShortSpans([
        { normalizedShortName: 'rusty ax' },
    ])
    const catalogAxeOnly = buildAdmissibleShortSpans([
        { normalizedShortName: 'rusty axe' },
    ])

    it('is always inactive for length-1 spans', () => {
        expect(isLexicalChannelActive('a', catalogWithAx)).toBe(false)
        expect(isLexicalChannelActive('a', new Set(['a']))).toBe(false)
    })

    it('is inactive for inadmissible length-2 span ax vs axe-only catalog', () => {
        expect(isLexicalChannelActive('ax', catalogAxeOnly)).toBe(false)
    })

    it('is active for admissible length-2 span ax when catalog has ax token', () => {
        expect(isLexicalChannelActive('ax', catalogWithAx)).toBe(true)
    })

    it('is active for spans at or above S_min', () => {
        expect(isLexicalChannelActive('broom', catalogAxeOnly)).toBe(true)
        expect(isLexicalChannelActive('sword', new Set())).toBe(true)
    })

    it('is inactive for empty span', () => {
        expect(isLexicalChannelActive('', catalogWithAx)).toBe(false)
    })
})

describe('lexical channel absent integration', () => {
    it('does not invoke lexical scoring at scan level when channel inactive', () => {
        const catalogAxeOnly = buildAdmissibleShortSpans([
            { normalizedShortName: 'rusty axe' },
        ])
        expect(isLexicalChannelActive('ax', catalogAxeOnly)).toBe(false)
        // When inactive, FT-1.2 drops w_l; lexicalRelevance may still be called per-pair
        // but the scan-level gate is what matters for RMS.
    })

    it('allows lexical scoring when channel active for unary exact match', () => {
        const unary = buildAdmissibleShortSpans([{ normalizedShortName: 'sword' }])
        expect(isLexicalChannelActive('sword', unary)).toBe(true)
        expect(lexicalRelevance('sword', 'sword')).toBeGreaterThan(0.97)
    })
})
