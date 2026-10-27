import { flankLengthMetricsOf, lexicalDiff } from '../lexicalDiff'
import { matchSpanLength } from '../lexicalMatchMetrics'
import { lexicalRelevance } from '../lexicalRelevance'
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

/** The flank score without the combine context (legacy) and with it (mitigated). */
const flankScoresForPair = (span: string, shortName: string): { legacy: number; mitigated: number } => {
    const diff = lexicalDiff(span, shortName)
    if (diff === undefined) {
        throw new Error(`no diff of "${span}" against "${shortName}"`)
    }
    const metrics = flankLengthMetricsOf(diff)
    const spanScale = Math.max(matchSpanLength(diff.match), diff.pattern.length, 1)
    return {
        legacy: tanhCenteredFlankScore(metrics, spanScale),
        mitigated: tanhCenteredFlankScore(metrics, spanScale, {}, {
            patternLength: diff.pattern.length,
            candidateTextLength: diff.text.length,
        }),
    }
}

export const compareFlankCombineLegacyRows = (
    fixtures: readonly { span: string; shortName: string }[]
): FlankCombineLegacyRow[] => (
    fixtures.map(({ span, shortName }) => {
        const { legacy, mitigated } = flankScoresForPair(span, shortName)
        return {
            span,
            shortName,
            mitigatedLex: lexicalRelevance(span, shortName),
            legacyFlankScore: legacy,
            mitigatedFlankScore: mitigated,
        }
    })
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
