import { flankLengthMetricsOf, lexicalDiff, type LexicalDiff } from './lexicalDiff'
import { computeLexicalMatchMetrics } from './testing/legacyLexicalRelevance'
import { LEXICAL_PARITY_PAIRS } from './testing/lexicalParityPairs'

const diffOf = (span: string, shortName: string): LexicalDiff => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        throw new Error(`no diff of "${span}" against "${shortName}"`)
    }
    return diff
}

/** Each range of a flank as the text it covers. */
const flankText = (diff: LexicalDiff, side: 'left' | 'right') => {
    const { partialWord, words, marks } = diff[side]
    const textOf = ({ start, end }: { start: number; end: number }) => diff.text.slice(start, end)
    return { partialWord: partialWord && textOf(partialWord), words: words.map(textOf), marks: marks.map(textOf) }
}

describe('lexicalDiff', () => {
    it('labels a span longer than the name as holding the surplus, in whole words', () => {
        const diff = diffOf('cup on saucer on table', 'cup')
        expect(diff.surplusSide).toBe('span')
        expect(diff.text.slice(diff.match.start, diff.match.end)).toBe('cup')
        expect(flankText(diff, 'left')).toEqual({ partialWord: undefined, words: [], marks: [] })
        expect(flankText(diff, 'right')).toEqual({ partialWord: undefined, words: ['on', 'saucer', 'on', 'table'], marks: [] })
    })

    it('labels a name longer than the span as holding the surplus', () => {
        const diff = diffOf('ax', 'rusty old ax')
        expect(diff.surplusSide).toBe('name')
        expect(flankText(diff, 'left')).toEqual({ partialWord: undefined, words: ['rusty', 'old'], marks: [] })
        expect(flankText(diff, 'right')).toEqual({ partialWord: undefined, words: [], marks: [] })
    })

    it('takes the span as the pattern on equal lengths', () => {
        expect(diffOf('cup', 'cap').surplusSide).toBe('name')
    })

    it('reads the rest of a word the match cuts into as a partial word', () => {
        expect(flankText(diffOf('ax', 'axle'), 'right')).toEqual({ partialWord: 'le', words: [], marks: [] })
        const inside = diffOf('ax', 'taxi')
        expect(flankText(inside, 'left')).toEqual({ partialWord: 't', words: [], marks: [] })
        expect(flankText(inside, 'right')).toEqual({ partialWord: 'i', words: [], marks: [] })
    })

    it('reads a punctuation mark as a mark', () => {
        const diff = diffOf('cup .', 'cup')
        expect(diff.surplusSide).toBe('span')
        expect(flankText(diff, 'right')).toEqual({ partialWord: undefined, words: [], marks: ['.'] })
    })

    it('holds edits inside the match, not as surplus', () => {
        const diff = diffOf('swrod', 'sword')
        expect(diff.match).toEqual({ start: 0, end: 5, distance: 1, ops: ['match', 'match', 'transpose', 'match'] })
        expect(flankText(diff, 'left')).toEqual({ partialWord: undefined, words: [], marks: [] })
        expect(flankText(diff, 'right')).toEqual({ partialWord: undefined, words: [], marks: [] })
    })

    it('has no diff when either side normalizes to empty', () => {
        expect(lexicalDiff('  ', 'cup')).toBeUndefined()
        expect(lexicalDiff('cup', '')).toBeUndefined()
    })

    // Where a lexeme and `deriveFlankLengthMetrics`' ASCII test cut a word differently: a word held
    // together by `-` or `'`, or holding a non-ASCII letter, is one word, so its rest is a partial word.
    it.each([
        ['encrusted', 'jewel-encrusted', 'left', 'jewel-'],
        ['don', "don't", 'right', "'t"],
        ['caf', 'café', 'right', 'é'],
    ] as const)('reads %s against %s as cutting one word', (span, shortName, side, partialWord) => {
        const diff = diffOf(span, shortName)
        expect(flankText(diff, side).partialWord).toBe(partialWord)
        const today = computeLexicalMatchMetrics(diff.pattern, diff.text)
        const adjoined = side === 'left' ? 'adjoinedLeftLength' : 'adjoinedRightLength'
        expect(flankLengthMetricsOf(diff)[adjoined]).toBe(partialWord.length)
        expect(today[adjoined]).toBe(0)
    })
})

describe('flankLengthMetricsOf', () => {
    it.each(LEXICAL_PARITY_PAIRS)('agrees with the flank split lexical relevance scores: %s against %s', (span, shortName) => {
        const diff = diffOf(span, shortName)
        const { editDistance, matchSpan, ...flankLengths } = computeLexicalMatchMetrics(diff.pattern, diff.text)
        expect(flankLengthMetricsOf(diff)).toEqual(flankLengths)
        expect({ start: diff.match.start, end: diff.match.end, distance: diff.match.distance }).toEqual({ ...matchSpan, distance: editDistance })
    })
})
