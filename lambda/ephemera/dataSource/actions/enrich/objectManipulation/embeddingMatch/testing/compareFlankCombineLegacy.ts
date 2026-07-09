import { lexicalRelevance } from '../lexicalRelevance'
import {
    computeLexicalMatchMetrics,
    matchSpanLength,
} from '../lexicalMatchMetrics'
import {
    coverageLiftFromEmbed,
    effectiveFlankCombineBias,
    tanhCenteredFlankScore,
} from '../relevanceCombine'
import { LEX_FLANK_COMBINE_BIAS } from '../thresholds'

export type FlankCombineLegacyRow = {
    span: string
    shortName: string
    mitigatedLex: number
    legacyFlankScore: number
    mitigatedFlankScore: number
}

const legacyFlankScoreForPair = (span: string, shortName: string): number => {
    const normalizedSpan = span.trim().toLowerCase()
    const normalizedShortName = shortName.trim().toLowerCase()
    const [pattern, candidateText] = normalizedSpan.length <= normalizedShortName.length
        ? [normalizedSpan, normalizedShortName]
        : [normalizedShortName, normalizedSpan]
    const metrics = computeLexicalMatchMetrics(pattern, candidateText)
    const spanScale = Math.max(matchSpanLength(metrics.matchSpan), pattern.length, 1)
    return tanhCenteredFlankScore(metrics, spanScale)
}

const mitigatedFlankScoreForPair = (span: string, shortName: string): number => {
    const normalizedSpan = span.trim().toLowerCase()
    const normalizedShortName = shortName.trim().toLowerCase()
    const [pattern, candidateText] = normalizedSpan.length <= normalizedShortName.length
        ? [normalizedSpan, normalizedShortName]
        : [normalizedShortName, normalizedSpan]
    const metrics = computeLexicalMatchMetrics(pattern, candidateText)
    const spanScale = Math.max(matchSpanLength(metrics.matchSpan), pattern.length, 1)
    return tanhCenteredFlankScore(metrics, spanScale, {}, {
        patternLength: pattern.length,
        candidateTextLength: candidateText.length,
    })
}

export const compareFlankCombineLegacyRows = (
    fixtures: readonly { span: string; shortName: string }[]
): FlankCombineLegacyRow[] => (
    fixtures.map(({ span, shortName }) => ({
        span,
        shortName,
        mitigatedLex: lexicalRelevance(span, shortName),
        legacyFlankScore: legacyFlankScoreForPair(span, shortName),
        mitigatedFlankScore: mitigatedFlankScoreForPair(span, shortName),
    }))
)

export const KEY_SHORT_SPAN_FIXTURES = [
    { span: 'a', shortName: 'axe' },
    { span: 'a', shortName: 'anvil' },
    { span: 'a', shortName: 'lantern' },
    { span: 'gem', shortName: 'gemstones' },
    { span: 'don', shortName: 'wimbledon' },
    { span: 'gem', shortName: 'gem' },
    { span: 'ax', shortName: 'axolotl' },
    { span: 'ax', shortName: 'coaxial' },
    { span: 'ax', shortName: 'rusty ax' },
    { span: 'ax', shortName: 'axle' },
    { span: 'broom', shortName: 'broom' },
    { span: 'broom', shortName: 'the ancient wrought iron broom' },
    { span: 'sweeping tool', shortName: 'broom' },
] as const

/** Same embed coverage (1/3) as a/axe; legitimate prefix stem at S_MIN. */
export const PROPORTIONATE_COVERAGE_FIXTURES = [
    { span: 'a', shortName: 'axe' },
    { span: 'gem', shortName: 'gemstones' },
    { span: 'don', shortName: 'wimbledon' },
    { span: 'gem', shortName: 'gem' },
] as const

export const legacyConstantBias = (): number => LEX_FLANK_COMBINE_BIAS

export { coverageLiftFromEmbed, effectiveFlankCombineBias }
