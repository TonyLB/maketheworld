import { lexicalDiff, type LexicalDiff } from './lexicalDiff'
import { LEXICAL_WEIGHTS, priceLexicalDiff, type LexicalWeights } from './lexicalWeights'
import type { RelevanceNormalizationParams } from './thresholds'

const diffOf = (span: string, shortName: string): LexicalDiff => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        throw new Error(`no diff of "${span}" against "${shortName}"`)
    }
    return diff
}

describe('priceLexicalDiff', () => {
    it('prices a diff as the product of its rows', () => {
        const diff = diffOf('cup on saucer', 'chipped cup')
        const rows = [LEXICAL_WEIGHTS.edits, LEXICAL_WEIGHTS.surplus.name, LEXICAL_WEIGHTS.surplus.span, LEXICAL_WEIGHTS.interior.name, LEXICAL_WEIGHTS.interior.span]
            .map((row) => row(diff, {}))
        expect(priceLexicalDiff(diff)).toBeCloseTo(rows.reduce((product, row) => product * row, 1), 12)
    })

    it('prices a span with no surplus by the edits and the name rows alone (the span row is 1)', () => {
        expect(LEXICAL_WEIGHTS.surplus.span(diffOf('ax', 'rusty old ax'), {})).toBe(1)
        expect(LEXICAL_WEIGHTS.surplus.span(diffOf('sord', 'sword'), {})).toBe(1)
    })

    it('applies the name row to every diff, its surplus or none', () => {
        const unforgiving: LexicalWeights = { ...LEXICAL_WEIGHTS, surplus: { ...LEXICAL_WEIGHTS.surplus, name: () => 0 } }
        expect(priceLexicalDiff(diffOf('cup on saucer', 'cup'), {}, unforgiving)).toBe(0)
    })

    it('grows the span row\'s cost with the span\'s surplus, uncapped', () => {
        const spanRow = (span: string) => LEXICAL_WEIGHTS.surplus.span(diffOf(span, 'cup'), {})
        expect(spanRow('cup on saucer')).toBeLessThan(spanRow('cup on'))
        expect(spanRow('cup on saucer on table on floor of room')).toBeLessThan(0.05)
    })

    it('reaches each row with the params', () => {
        const tuned: RelevanceNormalizationParams = { lexRemoteFlankWeight: 1.2, lexAdjoinedFlankWeight: 0.7, lexFlankCombineBias: 2, lexSpanSurplusRate: 2 }
        expect(priceLexicalDiff(diffOf('ax', 'rusty old ax'), tuned)).not.toBe(priceLexicalDiff(diffOf('ax', 'rusty old ax')))
        expect(priceLexicalDiff(diffOf('cup on saucer', 'cup'), tuned)).toBeLessThan(priceLexicalDiff(diffOf('cup on saucer', 'cup')))
    })

    it('prices each side\'s interior words by its own rate, both 0 for now', () => {
        const nameInterior = diffOf('rusty ax', 'rusty old ax')
        const spanInterior = diffOf('red big box', 'red box')
        expect([LEXICAL_WEIGHTS.interior.name(nameInterior, {}), LEXICAL_WEIGHTS.interior.span(spanInterior, {})]).toEqual([1, 1])
        expect(LEXICAL_WEIGHTS.interior.name(nameInterior, { lexInteriorNameWordRate: 1 })).toBeLessThan(1)
        expect(LEXICAL_WEIGHTS.interior.span(nameInterior, { lexInteriorSpanWordRate: 1 })).toBe(1)
        expect(LEXICAL_WEIGHTS.interior.span(spanInterior, { lexInteriorSpanWordRate: 1 })).toBeLessThan(1)
        expect(LEXICAL_WEIGHTS.interior.name(spanInterior, { lexInteriorNameWordRate: 1 })).toBe(1)
    })
})
