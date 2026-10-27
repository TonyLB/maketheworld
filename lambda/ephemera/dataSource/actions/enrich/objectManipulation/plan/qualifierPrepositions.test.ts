import { granulesOf, tokenize } from '../../../deterministicTemplate/granuleTokens'
import { fixedWordsOf, matchPatternFills } from '../../../deterministicTemplate/patternTemplate'
import { PLAN_GRANULES } from './planSkeleton'
import { exceedsQualifierCap, QUALIFIER_PREPOSITION_ELEMENT } from './qualifierPrepositions'

/** The canonical preposition a whole text names, read through the pattern element. */
const canonicalOf = (text: string) => {
    const [fill] = matchPatternFills([QUALIFIER_PREPOSITION_ELEMENT], tokenize(granulesOf(fixedWordsOf([QUALIFIER_PREPOSITION_ELEMENT])), text))
    const capture = fill?.captures.preposition
    return capture?.kind === 'templateText' ? capture.value : undefined
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
})

describe('exceedsQualifierCap', () => {
    const exceeds = (command: string) => exceedsQualifierCap(tokenize(PLAN_GRANULES, command))

    it('counts each place a closed-set preposition stands, once however many options match there', () => {
        expect(exceeds('take a on b on c on d on e on f on g')).toBe(false)
        expect(exceeds('take a on b on c on d on e on f on g on h')).toBe(true)
        expect(exceeds('take a on top of b on top of c on top of d on top of e on top of f on top of g')).toBe(false)
    })

    it('counts no motion word and no word outside the set', () => {
        expect(exceeds('put a onto b into c under d onto e into f under g onto h')).toBe(false)
    })
})
