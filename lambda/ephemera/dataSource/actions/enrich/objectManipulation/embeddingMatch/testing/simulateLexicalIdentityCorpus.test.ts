import { simulateLexicalIdentityCorpus } from './simulateLexicalIdentityCorpus'
import { flankLengthMetricsOf, lexicalDiff } from '../lexicalDiff'
import { lexicalRelevance } from '../lexicalRelevance'
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
        const wrapperDiff = lexicalDiff('broom', 'the extraordinarily detailed antique wooden broom')
        if (wrapperDiff === undefined) {
            throw new Error('no diff of the wrapper case')
        }
        const wrapperMetrics = flankLengthMetricsOf(wrapperDiff)
        const spanScale = 5
        const tanhFlank = tanhCenteredFlankScore(wrapperMetrics, spanScale)
        const multiplicativeFlank = multiplicativeFlankScoreV1(wrapperMetrics, spanScale)
        expect(tanhFlank).toBeGreaterThan(multiplicativeFlank)
        expect(tanhFlank).toBeGreaterThan(0.4)
    })
})
