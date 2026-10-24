import { matchPatternAgainstTokens } from '../../../deterministicTemplate/patternTemplate'
import { QUALIFIER_OPTIONS, QUALIFIER_PHRASES, QUALIFIER_PREPOSITION_ELEMENT } from './qualifierPrepositions'

/** The canonical preposition a whole text token names, read through the pattern element. */
const canonicalOf = (text: string) => {
    const [fill] = matchPatternAgainstTokens([QUALIFIER_PREPOSITION_ELEMENT], [{ type: 'text', text }])
    const capture = fill?.captures[0]
    return capture?.kind === 'templateText' ? QUALIFIER_OPTIONS[capture.option] : undefined
}

describe('QUALIFIER_PREPOSITION_ELEMENT', () => {
    it.each([
        ['on', 'on'],
        ['on top of', 'on top of'],
        ['off', 'off'],
        ['in', 'in'],
        ['inside', 'inside'],
        ['out of', 'out of'],
        ['out', 'out of'],
        ['from', 'from'],
        ['  On   Top  OF ', 'on top of'],
    ])('reads "%s" as %s', (text, expected) => {
        expect(canonicalOf(text)).toBe(expected)
    })

    it.each(['onto', 'into', 'under', 'of', 'with', 'hurriedly from'])('reads "%s" as no qualifier', (text) => {
        expect(canonicalOf(text)).toBeUndefined()
    })

    it('lists multi-word phrases first, for a split inside free text', () => {
        expect(QUALIFIER_PHRASES.slice(0, 2)).toEqual(['on top of', 'out of'])
    })
})
