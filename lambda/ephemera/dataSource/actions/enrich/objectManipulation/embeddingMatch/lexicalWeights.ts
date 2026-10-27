/**
 * The lexical cost table: what each class of difference in a `LexicalDiff` costs, kept apart from
 * the alignment that finds the differences (`lexicalDiff.ts`).
 *
 * One row prices the edits inside the match; one row per side prices that side's surplus, its
 * partial words and whole words together (with its punctuation marks and spaces). They are one
 * row, not two, because today's flank combine (`tanhCenteredFlankScore`) sums the partial-word
 * (adjoined) and whole-word (remote) evidence inside one sigmoid, with a bias and a damping
 * that are tuning of that combine, not classes of their own. A row's value is a factor in [0, 1],
 * and the score is the product of the edits row and the surplus side's row.
 *
 * Both sides' rows are today's combine, which is the catalog-name side's forgiveness ("ax" finds
 * "rusty old ax"). The span side's row is to be replaced by a cost of its own
 * (`AGENT.skeletonMatcher.planning.md` 4d).
 */

import { clampUnitInterval } from './evidenceNumerics'
import { flankLengthMetricsOf, type FlankDiff, type LexicalDiff, type LexicalSide } from './lexicalDiff'
import { editDistanceRelevance } from './lexicalMatchMetrics'
import { tanhCenteredFlankScore } from './relevanceCombine'
import type { RelevanceNormalizationParams } from './thresholds'
import type { TextRange } from './types'

/** One side's surplus: its flanks, with the match and the string their ranges index. */
export type SideSurplus = {
    text: string
    match: TextRange
    left: FlankDiff
    right: FlankDiff
    patternLength: number
}

/** Prices one side's surplus, as a factor in [0, 1]. */
export type SurplusWeight = (surplus: SideSurplus, params: RelevanceNormalizationParams) => number

/** Prices the edits inside the match, as a factor in [0, 1]. */
export type EditsWeight = (match: LexicalDiff['match'], patternLength: number) => number

export type LexicalWeights = {
    edits: EditsWeight
    surplus: Record<LexicalSide, SurplusWeight>
}

const matchLength = ({ start, end }: TextRange): number => end - start

/** The edit gate: the edits normalized by the longer of the match and the pattern. */
const editGate: EditsWeight = (match, patternLength) => (
    editDistanceRelevance(match.distance, matchLength(match), patternLength)
)

/**
 * Today's flank combine: the partial words as adjoined flank, the rest as remote, scaled to the
 * longer of the match and the pattern, with the bias interpolated from how much of the text the
 * pattern covers.
 */
const catalogSideFlankWeight: SurplusWeight = (surplus, params) => (
    tanhCenteredFlankScore(
        flankLengthMetricsOf(surplus),
        Math.max(matchLength(surplus.match), surplus.patternLength, 1),
        params,
        { patternLength: surplus.patternLength, candidateTextLength: surplus.text.length }
    )
)

export const LEXICAL_WEIGHTS: LexicalWeights = {
    edits: editGate,
    surplus: {
        name: catalogSideFlankWeight,
        span: catalogSideFlankWeight,
    },
}

/**
 * The lexical score of a diff under a cost table. Only the side Sellers reports surplus words on
 * (`surplusSide`) is priced: the other side's surplus is edits inside the match.
 */
export function priceLexicalDiff(
    { pattern, text, surplusSide, match, left, right }: LexicalDiff,
    params: RelevanceNormalizationParams = {},
    weights: LexicalWeights = LEXICAL_WEIGHTS
): number {
    return clampUnitInterval(
        weights.edits(match, pattern.length)
        * weights.surplus[surplusSide]({ text, match, left, right, patternLength: pattern.length }, params)
    )
}
