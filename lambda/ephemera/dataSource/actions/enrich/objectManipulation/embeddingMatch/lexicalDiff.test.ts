import { flankLengthMetricsOf, lexicalDiff, type LexicalDiff, type LexicalSide } from './lexicalDiff'
import type { TextRange } from './types'

const diffOf = (span: string, shortName: string): LexicalDiff => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        throw new Error(`no diff of "${span}" against "${shortName}"`)
    }
    return diff
}

/** One side's match, skipped words and flanks as the text they cover. */
const sideText = (diff: LexicalDiff, side: LexicalSide) => {
    const { text, match, skipped, left, right } = diff[side]
    const textOf = ({ start, end }: TextRange) => text.slice(start, end)
    const flank = ({ partialWord, words, marks }: typeof left) => ({ partialWord: partialWord && textOf(partialWord), words: words.map(textOf), marks: marks.map(textOf) })
    return { match: textOf(match), skipped: skipped.map(textOf), left: flank(left), right: flank(right) }
}

const none = { partialWord: undefined, words: [], marks: [] }

describe('lexicalDiff', () => {
    it('reads a span\'s extra words as the span\'s surplus', () => {
        const diff = diffOf('cup on saucer on table', 'cup')
        expect(sideText(diff, 'span')).toEqual({ match: 'cup', skipped: [], left: none, right: { ...none, words: ['on', 'saucer', 'on', 'table'] } })
        expect(sideText(diff, 'name')).toEqual({ match: 'cup', skipped: [], left: none, right: none })
    })

    it('reads a name\'s extra words as the name\'s surplus', () => {
        const diff = diffOf('ax', 'rusty old ax')
        expect(sideText(diff, 'name')).toEqual({ match: 'ax', skipped: [], left: { ...none, words: ['rusty', 'old'] }, right: none })
        expect(sideText(diff, 'span')).toEqual({ match: 'ax', skipped: [], left: none, right: none })
    })

    it('reads both sides\' surplus at once: `cup on table` against "kitchen table"', () => {
        const diff = diffOf('cup on table', 'kitchen table')
        expect(sideText(diff, 'span')).toEqual({ match: 'table', skipped: [], left: { ...none, words: ['cup', 'on'] }, right: none })
        expect(sideText(diff, 'name')).toEqual({ match: 'table', skipped: [], left: { ...none, words: ['kitchen'] }, right: none })
    })

    it('reads partial words on both sides: `abcdef` against "defghi"', () => {
        const diff = diffOf('abcdef', 'defghi')
        expect(sideText(diff, 'span').left).toEqual({ ...none, partialWord: 'abc' })
        expect(sideText(diff, 'name').right).toEqual({ ...none, partialWord: 'ghi' })
    })

    it('reads the rest of a word the match cuts into as a partial word', () => {
        expect(sideText(diffOf('ax', 'axle'), 'name').right).toEqual({ ...none, partialWord: 'le' })
        const inside = sideText(diffOf('ax', 'taxi'), 'name')
        expect([inside.left, inside.right]).toEqual([{ ...none, partialWord: 't' }, { ...none, partialWord: 'i' }])
    })

    it('reads a word skipped inside the match as that side\'s surplus', () => {
        expect(sideText(diffOf('rusty ax', 'rusty old ax'), 'name')).toEqual({ match: 'rusty old ax', skipped: ['old'], left: none, right: none })
        expect(sideText(diffOf('red big box', 'red box'), 'span')).toEqual({ match: 'red big box', skipped: ['big'], left: none, right: none })
    })

    it('reads a punctuation mark as a mark', () => {
        expect(sideText(diffOf('cup .', 'cup'), 'span').right).toEqual({ ...none, marks: ['.'] })
    })

    it('holds edits inside the word pairs, not as surplus', () => {
        const diff = diffOf('swrod', 'sword')
        expect(diff).toMatchObject({ edits: 1, boundaries: 0, ops: ['match', 'match', 'transpose', 'match'] })
        expect(sideText(diff, 'span')).toEqual({ match: 'swrod', skipped: [], left: none, right: none })
    })

    it('has no diff when either side normalizes to empty, or no pair of their words aligns', () => {
        expect(lexicalDiff('  ', 'cup')).toBeUndefined()
        expect(lexicalDiff('cup', '')).toBeUndefined()
        expect(lexicalDiff('sword', 'anvil')).toBeUndefined()
    })

    // A word held together by `-` or `'`, or holding a non-ASCII letter, is one word, so the rest of
    // it past a match edge is a partial word.
    it.each([
        ['encrusted', 'jewel-encrusted', 'left', 'jewel-'],
        ['don', "don't", 'right', "'t"],
        ['caf', 'café', 'right', 'é'],
    ] as const)('reads %s against %s as cutting one word', (span, shortName, flank, partialWord) => {
        const diff = diffOf(span, shortName)
        expect(sideText(diff, 'name')[flank].partialWord).toBe(partialWord)
        expect(flankLengthMetricsOf(diff.name)[flank === 'left' ? 'adjoinedLeftLength' : 'adjoinedRightLength']).toBe(partialWord.length)
    })
})

describe('flankLengthMetricsOf', () => {
    it('reads partial words as adjoined and the rest of the flank as remote', () => {
        expect(flankLengthMetricsOf(diffOf('ax', 'rusty old taxi').name)).toEqual({ adjoinedLeftLength: 1, adjoinedRightLength: 1, remoteLeftLength: 10, remoteRightLength: 0 })
    })

    it('reads no skipped word inside the match as flank', () => {
        expect(flankLengthMetricsOf(diffOf('rusty ax', 'rusty old ax').name)).toEqual({ adjoinedLeftLength: 0, adjoinedRightLength: 0, remoteLeftLength: 0, remoteRightLength: 0 })
    })
})
