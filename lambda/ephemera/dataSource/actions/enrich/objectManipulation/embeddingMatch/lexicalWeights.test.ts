import { lexicalDiff, type LexicalDiff } from './lexicalDiff'
import { LEXICAL_WEIGHTS, priceLexicalDiff, type LexicalWeights, type SurplusWeight } from './lexicalWeights'
import { legacyLexicalRelevance } from './testing/legacyLexicalRelevance'
import { LEXICAL_PARITY_PAIRS } from './testing/lexicalParityPairs'
import type { RelevanceNormalizationParams } from './thresholds'

const diffOf = (span: string, shortName: string): LexicalDiff => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        throw new Error(`no diff of "${span}" against "${shortName}"`)
    }
    return diff
}

const unreachable: SurplusWeight = () => {
    throw new Error('priced the side without surplus words')
}

describe('priceLexicalDiff', () => {
    const tuned: RelevanceNormalizationParams = { lexRemoteFlankWeight: 1.2, lexAdjoinedFlankWeight: 0.7, lexFlankCombineBias: 2 }

    it.each(LEXICAL_PARITY_PAIRS)('equals the pre-4c lexical relevance: %s against %s', (span, shortName) => {
        expect(priceLexicalDiff(diffOf(span, shortName))).toBe(legacyLexicalRelevance(span, shortName))
        expect(priceLexicalDiff(diffOf(span, shortName), tuned)).toBe(legacyLexicalRelevance(span, shortName, tuned))
    })

    it('reaches the rows with the params (the tuned params move a score)', () => {
        expect(priceLexicalDiff(diffOf('ax', 'rusty old ax'), tuned)).not.toBe(priceLexicalDiff(diffOf('ax', 'rusty old ax')))
    })

    it.each([
        ['ax', 'rusty old ax', 'name'],
        ['cup on saucer on table', 'cup', 'span'],
    ] as const)('prices %s against %s by the %s row only', (span, shortName, side) => {
        const weights: LexicalWeights = {
            ...LEXICAL_WEIGHTS,
            surplus: { name: unreachable, span: unreachable, [side]: LEXICAL_WEIGHTS.surplus[side] },
        }
        expect(priceLexicalDiff(diffOf(span, shortName), {}, weights)).toBe(legacyLexicalRelevance(span, shortName))
    })
})
