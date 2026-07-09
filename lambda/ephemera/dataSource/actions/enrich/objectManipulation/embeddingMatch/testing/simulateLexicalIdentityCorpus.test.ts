import { simulateLexicalIdentityCorpus } from './simulateLexicalIdentityCorpus'
import { lexicalRelevance } from '../lexicalRelevance'
import {
    computeLexicalMatchMetrics,
    editDistanceRelevance,
    lexicalRelevanceFromMetrics,
    matchSpanLength,
} from '../lexicalMatchMetrics'
import {
    multiplicativeFlankScoreV1,
    tanhCenteredFlankScore,
} from '../relevanceCombine'

describe('simulateLexicalIdentityCorpus', () => {
    const results = simulateLexicalIdentityCorpus()

    it('ranks broom first for sweeping tool paraphrase when lexical should help', () => {
        const paraphrase = results.find((entry) => entry.caseId === 'identity-003-broom-paraphrase')
        expect(paraphrase?.ranked[0]?.shortName).toBe('broom')
        expect(paraphrase?.topLexicalScore).toBeGreaterThan(0)
        expect(paraphrase?.topLexicalScore).toBeLessThan(0.4)
    })

    it('keeps absent-object head lexical score well below exact match', () => {
        const absent = results.find((entry) => entry.caseId === 'identity-001-absent-sword')
        expect(absent?.topLexicalScore).toBeLessThan(0.4)
        expect(absent?.topLexicalScore).toBeLessThan(lexicalRelevance('sword', 'sword'))
    })

    it('keeps hard-negative paraphrase head lexical score low', () => {
        const hardNegative = results.find((entry) => entry.caseId === 'identity-005-hard-negative-span')
        expect(hardNegative?.topLexicalScore).toBeLessThan(0.4)
    })

    it('reports identical lexical scores for duplicate shortNames', () => {
        const duplicate = results.find((entry) => entry.caseId === 'identity-004-duplicate-shortname')
        const scores = duplicate?.ranked.map((entry) => entry.lexicalScore) ?? []
        expect(scores[0]).toBe(scores[1])
    })
})

describe('lexical combine A/B on identity corpus metrics', () => {
    it('tanh flank scores spread more middle-band mass than multiplicative v1 on wrapper cases', () => {
        const wrapperMetrics = computeLexicalMatchMetrics('broom', 'the extraordinarily detailed antique wooden broom')
        const spanScale = 5
        const tanhFlank = tanhCenteredFlankScore(wrapperMetrics, spanScale)
        const multiplicativeFlank = multiplicativeFlankScoreV1(wrapperMetrics, spanScale)
        expect(tanhFlank).toBeGreaterThan(multiplicativeFlank)
        expect(tanhFlank).toBeGreaterThan(0.4)
    })

    it('production lexical path matches edit gate times tanh flank score', () => {
        const metrics = computeLexicalMatchMetrics('broom', 'the broom')
        const spanScale = Math.max(matchSpanLength(metrics.matchSpan), 5, 1)
        const productionScore = lexicalRelevanceFromMetrics(metrics, 5)
        const editFactor = editDistanceRelevance(metrics.editDistance, matchSpanLength(metrics.matchSpan), 5)
        const expected = editFactor * tanhCenteredFlankScore(metrics, spanScale)
        expect(productionScore).toBeCloseTo(expected)
        expect(lexicalRelevance('broom', 'the broom')).toBeCloseTo(productionScore)
    })
})
