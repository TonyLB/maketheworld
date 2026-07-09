import {
    computeLexicalMatchMetrics,
    flankLengthRelevance,
} from './lexicalMatchMetrics'
import {
    centeredTanhEvidence,
    multiplicativeFlankScoreV1,
    tanhCenteredFlankScore,
    weightedRmsJointRelevance,
} from './relevanceCombine'
import {
    LEX_ADJOINED_FLANK_MAX_DAMAGE,
    LEX_FLANK_RELEVANCE_K,
    LEX_REMOTE_FLANK_MAX_DAMAGE,
} from './thresholds'

describe('centeredTanhEvidence', () => {
    const midpoint = 2
    const scale = 1
    const weight = 1

    it('returns positive evidence when value is better than midpoint (x < m)', () => {
        expect(centeredTanhEvidence({ value: 0, midpoint, scale, weight })).toBeGreaterThan(0)
    })

    it('returns zero at midpoint', () => {
        expect(centeredTanhEvidence({ value: midpoint, midpoint, scale, weight })).toBeCloseTo(0)
    })

    it('saturates negative for large flank length', () => {
        expect(centeredTanhEvidence({ value: 100, midpoint, scale, weight })).toBeCloseTo(-weight)
    })

    it('rejects non-positive scale', () => {
        expect(() => centeredTanhEvidence({ value: 0, midpoint, scale: 0, weight })).toThrow(/scale/)
    })
})

describe('tanhCenteredFlankScore', () => {
    it('scores zero flanks highly', () => {
        const metrics = computeLexicalMatchMetrics('broom', 'broom')
        const score = tanhCenteredFlankScore(metrics, 5)
        expect(score).toBeGreaterThan(0.9)
    })

    it('penalizes long remote wrapper but stays in middle band', () => {
        const metrics = computeLexicalMatchMetrics('broom', 'the extraordinarily detailed antique wooden broom')
        const cleanMetrics = computeLexicalMatchMetrics('broom', 'broom')
        const wrappedScore = tanhCenteredFlankScore(metrics, 5)
        const cleanScore = tanhCenteredFlankScore(cleanMetrics, 5)
        expect(wrappedScore).toBeLessThan(cleanScore)
        expect(wrappedScore).toBeGreaterThan(0.4)
    })

    it('lets positive adjoined evidence partially offset depressed remote wrapper', () => {
        const spanScale = 5
        const remoteMidpoint = spanScale * 3
        const withBestAdjoined = tanhCenteredFlankScore({
            adjoinedLeftLength: 0,
            adjoinedRightLength: 0,
            remoteLeftLength: remoteMidpoint,
            remoteRightLength: 0,
        }, spanScale)
        const withNeutralAdjoined = tanhCenteredFlankScore({
            adjoinedLeftLength: spanScale / 2,
            adjoinedRightLength: spanScale / 2,
            remoteLeftLength: remoteMidpoint,
            remoteRightLength: 0,
        }, spanScale)
        expect(withBestAdjoined).toBeGreaterThan(withNeutralAdjoined)
    })
})

describe('weightedRmsJointRelevance', () => {
    it('returns RMS when both signals present', () => {
        expect(weightedRmsJointRelevance({ lex: 1, embed: 0 })).toBeCloseTo(Math.SQRT1_2)
        expect(weightedRmsJointRelevance({ lex: 0.5, embed: 0.5 })).toBeCloseTo(0.5)
    })

    it('returns lex alone when embed absent', () => {
        expect(weightedRmsJointRelevance({ lex: 0.8 })).toBeCloseTo(0.8)
    })

    it('returns embed alone when lex absent', () => {
        expect(weightedRmsJointRelevance({ embed: 0.6 })).toBeCloseTo(0.6)
    })

    it('returns 0 when both channels absent', () => {
        expect(weightedRmsJointRelevance({})).toBe(0)
    })

    it('rejects non-finite inputs when a channel is present', () => {
        expect(() => weightedRmsJointRelevance({ lex: Number.NaN, embed: 0.5 })).toThrow(/finite/)
        expect(() => weightedRmsJointRelevance({ embed: Number.POSITIVE_INFINITY })).toThrow(/finite/)
    })
})

describe('multiplicativeFlankScoreV1', () => {
    it('matches product of flankLengthRelevance factors', () => {
        const metrics = computeLexicalMatchMetrics('ax', 'axle')
        const spanScale = 2
        const v1Score = multiplicativeFlankScoreV1(metrics, spanScale)
        const expected = (
            flankLengthRelevance(metrics.adjoinedLeftLength, spanScale, LEX_ADJOINED_FLANK_MAX_DAMAGE, LEX_FLANK_RELEVANCE_K)
            * flankLengthRelevance(metrics.adjoinedRightLength, spanScale, LEX_ADJOINED_FLANK_MAX_DAMAGE, LEX_FLANK_RELEVANCE_K)
            * flankLengthRelevance(
                metrics.remoteLeftLength + metrics.remoteRightLength,
                spanScale,
                LEX_REMOTE_FLANK_MAX_DAMAGE,
                LEX_FLANK_RELEVANCE_K
            )
        )
        expect(v1Score).toBeCloseTo(expected)
    })
})
