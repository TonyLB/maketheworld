import {
    buildAdmissibleShortSpans,
    isLegacyLexicalChannelActive,
} from './legacyLexicalChannelGate'
import { lexicalRelevance } from '../lexicalRelevance'

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

describe('isLegacyLexicalChannelActive', () => {
    const catalogWithAx = buildAdmissibleShortSpans([
        { normalizedShortName: 'rusty ax' },
    ])
    const catalogAxeOnly = buildAdmissibleShortSpans([
        { normalizedShortName: 'rusty axe' },
    ])

    it('legacy policy keeps length-1 spans inactive', () => {
        expect(isLegacyLexicalChannelActive('a', catalogWithAx)).toBe(false)
        expect(isLegacyLexicalChannelActive('a', new Set(['a']))).toBe(false)
    })

    it('is inactive for inadmissible length-2 span ax vs axe-only catalog', () => {
        expect(isLegacyLexicalChannelActive('ax', catalogAxeOnly)).toBe(false)
    })

    it('is active for admissible length-2 span ax when catalog has ax token', () => {
        expect(isLegacyLexicalChannelActive('ax', catalogWithAx)).toBe(true)
    })

    it('is active for spans at or above S_min', () => {
        expect(isLegacyLexicalChannelActive('broom', catalogAxeOnly)).toBe(true)
        expect(isLegacyLexicalChannelActive('sword', new Set())).toBe(true)
    })

    it('is inactive for empty span', () => {
        expect(isLegacyLexicalChannelActive('', catalogWithAx)).toBe(false)
    })
})

describe('lexical channel integration', () => {
    it('allows lexical scoring when channel active for unary exact match', () => {
        const unary = buildAdmissibleShortSpans([{ normalizedShortName: 'sword' }])
        expect(isLegacyLexicalChannelActive('sword', unary)).toBe(true)
        expect(lexicalRelevance('sword', 'sword')).toBeGreaterThan(0.97)
    })
})
