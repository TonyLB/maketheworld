import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'
import { lexemesOf } from '../../../deterministicTemplate/granuleTokens'

import { alignSpanToName } from './tokenAwareAlignment'
import { LEXICAL_PARITY_PAIRS } from './testing/lexicalParityPairs'
import { sellersApproximateSubstringMatch } from './testing/sellersApproximateSubstringMatch'
import type { TextRange } from './types'

const textOf = (text: string, { start, end }: TextRange): string => text.slice(start, end)

const aligned = (span: string, name: string) => {
    const alignment = alignSpanToName(span, name)
    if (alignment === undefined) {
        throw new Error(`no alignment of "${span}" against "${name}"`)
    }
    return alignment
}

describe('alignSpanToName', () => {
    it('merges words across a boundary: `coupon` against "cup on"', () => {
        const alignment = aligned('coupon', 'cup on')
        expect(alignment).toMatchObject({ span: { start: 0, end: 6 }, name: { start: 0, end: 6 }, edits: 1, boundaries: 1 })
        expect(alignment.pairs).toEqual([{ span: { start: 0, end: 6 }, name: { start: 0, end: 6 } }])
    })

    it('leaves a span\'s extra words and a name\'s extra words whole: `cup on table` against "kitchen table"', () => {
        const alignment = aligned('cup on table', 'kitchen table')
        expect(textOf('cup on table', alignment.span)).toBe('table')
        expect(textOf('kitchen table', alignment.name)).toBe('table')
        expect(alignment.edits).toBe(0)
        expect(alignment.pairs).toEqual([{ span: { start: 7, end: 12 }, name: { start: 8, end: 13 } }])
    })

    it('cuts partial words on both sides: `abcdef` against "defghi"', () => {
        const alignment = aligned('abcdef', 'defghi')
        expect(textOf('abcdef', alignment.span)).toBe('def')
        expect(textOf('defghi', alignment.name)).toBe('def')
        expect(alignment.edits).toBe(0)
    })

    it('aligns a transposed word whole, not its exact prefix: `swrod` against "sword"', () => {
        expect(aligned('swrod', 'sword')).toMatchObject({ span: { start: 0, end: 5 }, name: { start: 0, end: 5 }, edits: 1, ops: ['match', 'match', 'transpose', 'match'] })
    })

    it('keeps the rest of a name word as a partial word: `ax` against "axle"', () => {
        expect(aligned('ax', 'axle')).toMatchObject({ name: { start: 0, end: 2 }, edits: 0 })
    })

    const pairsIn = (span: string, name: string) => aligned(span, name).pairs.map((pair) => [textOf(span, pair.span), textOf(name, pair.name)])

    it('skips a name\'s whole word inside the match, free: `rusty ax` against "rusty old ax"', () => {
        const alignment = aligned('rusty ax', 'rusty old ax')
        expect(alignment).toMatchObject({ span: { start: 0, end: 8 }, name: { start: 0, end: 12 }, edits: 0, boundaries: 0, skipped: { span: [], name: [{ start: 6, end: 9 }] } })
        expect(pairsIn('rusty ax', 'rusty old ax')).toEqual([['rusty', 'rusty'], ['ax', 'ax']])
        expect(pairsIn('pig blanket', 'pig in a blanket')).toEqual([['pig', 'pig'], ['blanket', 'blanket']])
    })

    it('skips a span\'s whole word inside the match: `red big box` against "red box"', () => {
        expect(aligned('red big box', 'red box')).toMatchObject({ span: { start: 0, end: 11 }, edits: 0, skipped: { span: [{ start: 4, end: 7 }], name: [] } })
    })

    it('pairs word for word across words that hold a typo: `man in teh moon` against "man in the moon"', () => {
        expect(pairsIn('man in teh moon', 'man in the moon')).toEqual([['man', 'man'], ['in', 'in'], ['teh', 'the'], ['moon', 'moon']])
    })

    it('merges span words across a boundary into one name word: `a b` against "ab"', () => {
        expect(aligned('a b', 'ab')).toMatchObject({ span: { start: 0, end: 3 }, name: { start: 0, end: 2 }, edits: 0, boundaries: 1 })
    })

    it('refuses a pair whose edits outweigh it, leaving its words to their sides', () => {
        expect(alignSpanToName('up', 'in')).toBeUndefined()
        expect(alignSpanToName('look', 'moon')).toBeUndefined()
        expect(alignSpanToName('sword', 'anvil')).toBeUndefined()
        expect(pairsIn('teh', 'the')).toEqual([['teh', 'the']])
    })

    it('pairs only what is close: `cup , then look` against "man in the moon"', () => {
        // `n` is left outside as the span's partial word, at the price of the delete that would pair it
        expect(pairsIn('cup , then look', 'man in the moon')).toEqual([['the', 'the']])
    })

    // `old of th` against "cloth" holds 3 edits in 7 letters (3 in 9 with its spaces), and `of th`
    // against "oth" would merge `of` with part of `the`: neither is a pair.
    it('pairs merged span words whole and by their letters: `hold of the cup` against "cloth"', () => {
        expect(aligned('hold of the cup', 'cloth')).toMatchObject({ edits: 0, boundaries: 0 })
        expect(pairsIn('hold of the cup', 'cloth')).toEqual([['th', 'th']])
    })

    it('pairs no name word over a run of span words its letters merely touch: `pig in a blanket` against "pig iron"', () => {
        expect(pairsIn('pig in a blanket', 'pig iron')).toEqual([['pig', 'pig']])
    })

    const oneWordSpanPairs = LEXICAL_PARITY_PAIRS
        .map(([span, shortName]) => [normalizeShortNameForEmbedding(span), normalizeShortNameForEmbedding(shortName)] as const)
        .filter(([span, name]) => lexemesOf(span).length === 1 && span.length <= name.length)

    // Sellers aligns the span whole, so a span letter it cannot pair is a delete; here it may be left
    // outside the match, at a delete's price, as span-side surplus. So the two agree on the cost, and
    // on the region wherever the span is aligned whole, but for a tied path Sellers resolves the
    // other way (`sord` against "sword": the same one edit, its region "word", ours "sword"). A pair
    // beyond the edit ratio has no alignment here at all.
    it.each(oneWordSpanPairs)('agrees with Sellers on a span of one word no longer than the name: %s against %s', (span, name) => {
        const sellers = sellersApproximateSubstringMatch(span, name)
        const alignment = alignSpanToName(span, name)
        if (alignment === undefined) {
            expect(sellers.distance).toBeGreaterThan(span.length / 3)
            return
        }
        const spanLeftOut = span.length - (alignment.span.end - alignment.span.start)
        expect(alignment.edits + spanLeftOut).toBe(sellers.distance)
        if (spanLeftOut === 0 && span !== 'sord') {
            expect(alignment.name).toEqual(sellers.matchSpan)
        }
    })
})
