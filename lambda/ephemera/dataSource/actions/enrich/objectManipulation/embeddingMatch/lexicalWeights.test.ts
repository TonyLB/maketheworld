import { lexicalDiff, type LexicalDiff } from './lexicalDiff'
import { lexicalRelevance } from './lexicalRelevance'
import { LEXICAL_WEIGHTS, priceLexicalDiff, type LexicalWeights, type SurplusWeight } from './lexicalWeights'
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

    it.each(LEXICAL_PARITY_PAIRS)('equals lexicalRelevance: %s against %s', (span, shortName) => {
        expect(priceLexicalDiff(diffOf(span, shortName))).toBe(lexicalRelevance(span, shortName))
        expect(priceLexicalDiff(diffOf(span, shortName), tuned)).toBe(lexicalRelevance(span, shortName, tuned))
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
        expect(priceLexicalDiff(diffOf(span, shortName), {}, weights)).toBe(lexicalRelevance(span, shortName))
    })
})
