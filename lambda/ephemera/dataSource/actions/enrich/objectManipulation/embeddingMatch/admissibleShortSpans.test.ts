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

    it('legacy policy keeps length-1 spans inactive', () => {
        expect(isLexicalChannelActive('a', catalogWithAx, undefined, 'legacy')).toBe(false)
        expect(isLexicalChannelActive('a', new Set(['a']), undefined, 'legacy')).toBe(false)
    })

    it('narrowed policy activates length-1 spans (FT-1.3.1)', () => {
        expect(isLexicalChannelActive('a', catalogWithAx, undefined, 'narrowed')).toBe(true)
        expect(isLexicalChannelActive('a', catalogAxeOnly, undefined, 'narrowed')).toBe(true)
    })

    it('is inactive for inadmissible length-2 span ax vs axe-only catalog', () => {
        expect(isLexicalChannelActive('ax', catalogAxeOnly, undefined, 'legacy')).toBe(false)
        expect(isLexicalChannelActive('ax', catalogAxeOnly, undefined, 'narrowed')).toBe(false)
    })

    it('is active for admissible length-2 span ax when catalog has ax token', () => {
        expect(isLexicalChannelActive('ax', catalogWithAx, undefined, 'narrowed')).toBe(true)
    })

    it('is active for spans at or above S_min', () => {
        expect(isLexicalChannelActive('broom', catalogAxeOnly, undefined, 'narrowed')).toBe(true)
        expect(isLexicalChannelActive('sword', new Set(), undefined, 'narrowed')).toBe(true)
    })

    it('is inactive for empty span', () => {
        expect(isLexicalChannelActive('', catalogWithAx, undefined, 'narrowed')).toBe(false)
    })

    it('alwaysActive scores every non-empty span', () => {
        expect(isLexicalChannelActive('ax', catalogAxeOnly, undefined, 'alwaysActive')).toBe(true)
        expect(isLexicalChannelActive('a', catalogAxeOnly, undefined, 'alwaysActive')).toBe(true)
    })
})

describe('lexical channel integration', () => {
    it('allows lexical scoring when channel active for unary exact match', () => {
        const unary = buildAdmissibleShortSpans([{ normalizedShortName: 'sword' }])
        expect(isLexicalChannelActive('sword', unary, undefined, 'narrowed')).toBe(true)
        expect(lexicalRelevance('sword', 'sword')).toBeGreaterThan(0.97)
    })
})
