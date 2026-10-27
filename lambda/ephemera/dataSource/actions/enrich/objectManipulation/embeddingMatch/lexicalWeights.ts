/**
 * The lexical cost table: what each class of difference in a `LexicalDiff` costs, kept apart from
 * the alignment that finds the differences (`lexicalDiff.ts`).
 *
 * One row prices the edits inside the word pairs; one row per side prices that side's surplus
 * around the match; one row per side prices that side's whole words skipped inside it. Each row's
 * value is a factor in [0, 1], and the score is their product.
 *
 * - The name side's row is today's flank combine (`tanhCenteredFlankScore`), the catalog side's
 *   forgiveness ("ax" finds "rusty old ax"): its partial words and whole words are read together,
 *   inside one sigmoid with a bias and a damping that are tuning of that combine, not classes of
 *   their own. It is applied to every diff, and its value at zero surplus is the base of every score.
 * - The span side's row is its own cost (`AGENT.skeletonMatcher.planning.md` SM-4): it grows with
 *   the span's surplus relative to the match, uncapped, and is exactly 1 at zero surplus, so a span
 *   with no extra words scores as the name row and the edits say.
 * - The interior rows price each side's words skipped inside the match, each at its own rate
 *   (`LEX_INTERIOR_NAME_WORD_RATE`, `LEX_INTERIOR_SPAN_WORD_RATE`). Both are 0 for now: whether
 *   either side's interior words deserve a penalty, or whether a word skipped on both sides at one
 *   place is a substitution to recognize, is rung 14's to judge.
 *
 * Boundaries (words split or merged) are priced by the alignment only.
 */

import { clampUnitInterval } from './evidenceNumerics'
import { flankLengthMetricsOf, type LexicalDiff, type LexicalSide, type SideDiff } from './lexicalDiff'
import { editDistanceRelevance, type FlankLengthMetrics } from './lexicalMatchMetrics'
import { tanhCenteredFlankScore, type FlankCombineContext } from './relevanceCombine'
import { LEX_SPAN_SURPLUS_RATE, type RelevanceNormalizationParams } from './thresholds'
import type { TextRange } from './types'

/** Prices one class of difference in a diff, as a factor in [0, 1]. */
export type LexicalWeight = (diff: LexicalDiff, params: RelevanceNormalizationParams) => number

export type LexicalWeights = {
    edits: LexicalWeight
    surplus: Record<LexicalSide, LexicalWeight>
    interior: Record<LexicalSide, LexicalWeight>
}

/** Rate for a catalog name's whole words skipped inside the match (placeholder; rung 14). */
export const LEX_INTERIOR_NAME_WORD_RATE = 0

/** Rate for a span's whole words skipped inside the match (placeholder; rung 14). */
export const LEX_INTERIOR_SPAN_WORD_RATE = 0

const rangeLength = ({ start, end }: TextRange): number => end - start

/** The length surplus is measured against: the longer of the two sides' matches. */
const matchScale = ({ span, name }: LexicalDiff): number => Math.max(rangeLength(span.match), rangeLength(name.match), 1)

/** The edit gate: the edits inside the word pairs, normalized by the longer of the two matches. */
const editGate: LexicalWeight = ({ span, name, edits }) => (
    editDistanceRelevance(edits, rangeLength(name.match), rangeLength(span.match))
)

/**
 * What today's flank combine reads of a diff: the name's surplus lengths (its partial words as
 * adjoined flank, the rest as remote), scaled to the longer match, with the bias interpolated from
 * how much of the name the span's match covers. The calibration harnesses read the same inputs.
 */
export function catalogSideFlankInputs(diff: LexicalDiff): { metrics: FlankLengthMetrics; spanScale: number; context: FlankCombineContext } {
    return {
        metrics: flankLengthMetricsOf(diff.name),
        spanScale: matchScale(diff),
        context: { patternLength: rangeLength(diff.span.match), candidateTextLength: diff.name.text.length },
    }
}

/** Today's flank combine over the name's surplus. */
const catalogSideFlankWeight: LexicalWeight = (diff, params) => {
    const { metrics, spanScale, context } = catalogSideFlankInputs(diff)
    return tanhCenteredFlankScore(metrics, spanScale, params, context)
}

const charactersIn = (ranges: TextRange[]): number => ranges.reduce((total, range) => total + rangeLength(range), 0)

/** The characters of a side's surplus around the match: its partial words, words and marks. */
const surplusCharacters = ({ left, right }: SideDiff): number => (
    charactersIn([left, right].flatMap(({ partialWord, words, marks }) => [...(partialWord ? [partialWord] : []), ...words, ...marks]))
)

/** The span's own surplus: exp(-rate * surplus characters / match scale). */
const spanSideSurplusWeight: LexicalWeight = (diff, params) => (
    Math.exp(-(params.lexSpanSurplusRate ?? LEX_SPAN_SURPLUS_RATE) * surplusCharacters(diff.span) / matchScale(diff))
)

/** A side's whole words skipped inside the match: exp(-rate * their characters / match scale). */
const interiorWordWeight = (side: LexicalSide, rateOf: (params: RelevanceNormalizationParams) => number): LexicalWeight => (diff, params) => (
    Math.exp(-rateOf(params) * charactersIn(diff[side].skipped) / matchScale(diff))
)

export const LEXICAL_WEIGHTS: LexicalWeights = {
    edits: editGate,
    surplus: {
        name: catalogSideFlankWeight,
        span: spanSideSurplusWeight,
    },
    interior: {
        name: interiorWordWeight('name', (params) => params.lexInteriorNameWordRate ?? LEX_INTERIOR_NAME_WORD_RATE),
        span: interiorWordWeight('span', (params) => params.lexInteriorSpanWordRate ?? LEX_INTERIOR_SPAN_WORD_RATE),
    },
}

/** The lexical score of a diff under a cost table: the product of its rows. */
export function priceLexicalDiff(
    diff: LexicalDiff,
    params: RelevanceNormalizationParams = {},
    weights: LexicalWeights = LEXICAL_WEIGHTS
): number {
    return clampUnitInterval(
        weights.edits(diff, params)
        * weights.surplus.name(diff, params) * weights.surplus.span(diff, params)
        * weights.interior.name(diff, params) * weights.interior.span(diff, params)
    )
}
