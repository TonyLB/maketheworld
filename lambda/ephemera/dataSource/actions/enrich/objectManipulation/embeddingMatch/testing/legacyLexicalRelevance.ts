/**
 * Lexical relevance as it was scored before it was re-expressed as diff then cost table
 * (`AGENT.skeletonMatcher.planning.md` 4c): Sellers' match of the shorter normalized string in
 * the longer, its flanks split by an ASCII test into adjoined and remote lengths, then the edit
 * gate times the tanh flank combine.
 *
 * Kept as the parity oracle: `lexicalRelevance` reproduces it on every pair except where a match
 * edge falls inside a word held together by `'` or `-`, or holding a non-ASCII letter, which a
 * lexeme keeps whole and the ASCII test cuts. It retires when the token-aware aligner replaces
 * Sellers (4d).
 */

import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import { clampUnitInterval } from '../evidenceNumerics'
import {
    editDistanceRelevance,
    matchSpanLength,
    type FlankLengthMetrics,
} from '../lexicalMatchMetrics'
import { tanhCenteredFlankScore } from '../relevanceCombine'
import { sellersApproximateSubstringMatch } from '../sellersApproximateSubstringMatch'
import type { RelevanceNormalizationParams } from '../thresholds'
import type { TextRange } from '../types'

const isAlpha = (char: string | undefined): boolean => (
    char !== undefined && /[a-z0-9]/i.test(char)
)

const isAlphaAdjoinedAt = (leftChar: string | undefined, rightChar: string | undefined): boolean => (
    isAlpha(leftChar) && isAlpha(rightChar)
)

const leadingAlphaRunLength = (segment: string): number => {
    const stopIndex = segment.split('').findIndex((char) => !isAlpha(char))
    return stopIndex === -1 ? segment.length : stopIndex
}

const trailingAlphaRunLength = (segment: string): number => {
    const stopIndex = segment.split('').reverse().findIndex((char) => !isAlpha(char))
    return stopIndex === -1 ? segment.length : stopIndex
}

export type LexicalMatchMetrics = FlankLengthMetrics & {
    editDistance: number
    matchSpan: TextRange
}

const adjoinedLeftLengthAt = (text: string, matchStart: number): number => {
    if (matchStart === 0) {
        return 0
    }
    if (!isAlphaAdjoinedAt(text[matchStart - 1], text[matchStart])) {
        return 0
    }

    return trailingAlphaRunLength(text.slice(0, matchStart))
}

const adjoinedRightLengthAt = (text: string, matchEnd: number): number => {
    if (matchEnd >= text.length) {
        return 0
    }
    if (!isAlphaAdjoinedAt(text[matchEnd - 1], text[matchEnd])) {
        return 0
    }

    return leadingAlphaRunLength(text.slice(matchEnd))
}

/**
 * Character lengths of flank material alpha-adjoined to the match vs separated by a non-alpha boundary.
 * Indices are in candidate text T; matchSpan is [start, end) in T.
 */
export function deriveFlankLengthMetrics(
    candidateText: string,
    matchSpan: TextRange
): FlankLengthMetrics {
    const { start, end } = matchSpan
    const adjoinedLeftLength = adjoinedLeftLengthAt(candidateText, start)
    const adjoinedRightLength = adjoinedRightLengthAt(candidateText, end)
    const remoteLeftLength = start - adjoinedLeftLength
    const remoteRightLength = candidateText.length - end - adjoinedRightLength

    return {
        adjoinedLeftLength,
        adjoinedRightLength,
        remoteLeftLength,
        remoteRightLength,
    }
}

/**
 * Sellers approximate substring match plus flank length decomposition for relevance scoring.
 */
export function computeLexicalMatchMetrics(
    pattern: string,
    candidateText: string
): LexicalMatchMetrics {
    const sellersMatch = sellersApproximateSubstringMatch(pattern, candidateText)
    const flankLengths = deriveFlankLengthMetrics(candidateText, sellersMatch.matchSpan)

    return {
        editDistance: sellersMatch.distance,
        matchSpan: sellersMatch.matchSpan,
        ...flankLengths,
    }
}

/**
 * Lexical relevance from precomputed Sellers + flank metrics (FT-1.1.5).
 *
 * editDistanceRelevance (hard gate) * tanhCenteredFlankScore
 */
export function lexicalRelevanceFromMetrics(
    metrics: LexicalMatchMetrics,
    patternLength: number,
    candidateTextLength: number,
    params: RelevanceNormalizationParams = {}
): number {
    const spanLen = matchSpanLength(metrics.matchSpan)
    const spanScale = Math.max(spanLen, patternLength, 1)

    const editFactor = editDistanceRelevance(metrics.editDistance, spanLen, patternLength)
    const flankScore = tanhCenteredFlankScore(metrics, spanScale, params, {
        patternLength,
        candidateTextLength,
    })

    return clampUnitInterval(editFactor * flankScore)
}

export function legacyLexicalRelevance(
    span: string,
    shortName: string,
    params: RelevanceNormalizationParams = {}
): number {
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const normalizedShortName = normalizeShortNameForEmbedding(shortName)

    if (normalizedSpan.length === 0 || normalizedShortName.length === 0) {
        return 0
    }

    const [pattern, candidateText] = normalizedSpan.length <= normalizedShortName.length
        ? [normalizedSpan, normalizedShortName]
        : [normalizedShortName, normalizedSpan]

    const metrics = computeLexicalMatchMetrics(pattern, candidateText)
    return lexicalRelevanceFromMetrics(metrics, pattern.length, candidateText.length, params)
}
