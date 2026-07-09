/**
 * Lexical match geometry and per-factor relevance building blocks.
 *
 * Pipeline toward pooled lexical relevance:
 * 1. Sellers approximate substring match locates the best alignment of pattern P in candidate T.
 * 2. deriveFlankLengthMetrics partitions flank material in T into adjoined vs remote lengths.
 * 3. editDistanceRelevance and flankLengthRelevance normalize each evidence channel to (0, 1].
 * 4. lexicalRelevanceFromMetrics multiplies the four factors (edit is the only channel that can hit 0).
 */

import {
    sellersApproximateSubstringMatch,
    type SellersMatchSpan,
} from './sellersApproximateSubstringMatch'
import {
    LEX_ADJOINED_FLANK_MAX_DAMAGE,
    LEX_FLANK_RELEVANCE_K,
    LEX_REMOTE_FLANK_MAX_DAMAGE,
    type RelevanceNormalizationParams,
} from './thresholds'

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

export type FlankLengthMetrics = {
    adjoinedLeftLength: number
    adjoinedRightLength: number
    remoteLeftLength: number
    remoteRightLength: number
}

export type LexicalMatchMetrics = FlankLengthMetrics & {
    editDistance: number
    matchSpan: SellersMatchSpan
}

export const matchSpanLength = (matchSpan: SellersMatchSpan): number => (
    matchSpan.end - matchSpan.start
)

/**
 * Character lengths of flank material alpha-adjoined to the match vs separated by a non-alpha boundary.
 * Indices are in candidate text T; matchSpan is [start, end) in T.
 */
export function deriveFlankLengthMetrics(
    candidateText: string,
    matchSpan: SellersMatchSpan
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

const assertFlankLengthRelevanceParams = (
    flankLength: number,
    matchSpanLength: number,
    maxDamage: number,
    k: number
): void => {
    if (!Number.isFinite(flankLength) || flankLength < 0) {
        throw new Error('flankLengthRelevance: flankLength must be a finite number >= 0')
    }
    if (!Number.isFinite(matchSpanLength) || matchSpanLength < 1) {
        throw new Error('flankLengthRelevance: matchSpanLength must be a finite number >= 1')
    }
    if (!Number.isFinite(maxDamage) || maxDamage <= 0 || maxDamage >= 1) {
        throw new Error('flankLengthRelevance: maxDamage must be a finite number in (0, 1)')
    }
    if (!Number.isFinite(k) || k <= 0) {
        throw new Error('flankLengthRelevance: k must be a finite number > 0')
    }
}

/**
 * Asymptotic flank relevance in [1 - maxDamage, 1].
 * Zero flank length -> 1; grows toward 1 - maxDamage as flank length increases in span multiples.
 *
 * `1 - maxDamage * (1 - exp(-k * flankLength / matchSpanLength))`
 */
export function flankLengthRelevance(
    flankLength: number,
    matchSpanLength: number,
    maxDamage: number,
    k: number
): number {
    assertFlankLengthRelevanceParams(flankLength, matchSpanLength, maxDamage, k)

    const scaledLength = flankLength / matchSpanLength
    return 1 - maxDamage * (1 - Math.exp(-k * scaledLength))
}

const assertEditDistanceRelevanceParams = (
    editDistance: number,
    matchSpanLength: number,
    patternLength: number
): void => {
    if (!Number.isFinite(editDistance) || editDistance < 0) {
        throw new Error('editDistanceRelevance: editDistance must be a finite number >= 0')
    }
    if (!Number.isFinite(matchSpanLength) || matchSpanLength < 0) {
        throw new Error('editDistanceRelevance: matchSpanLength must be a finite number >= 0')
    }
    if (!Number.isFinite(patternLength) || patternLength < 0) {
        throw new Error('editDistanceRelevance: patternLength must be a finite number >= 0')
    }
}

/**
 * Match-quality factor in [0, 1]. The only channel that can drive lexical relevance to zero.
 * Normalizes Sellers edit distance against max(|match span in T|, |P|):
 * `1 - min(1, editDistance / max(matchSpanLength, patternLength))`
 */
export function editDistanceRelevance(
    editDistance: number,
    matchSpanLength: number,
    patternLength: number
): number {
    assertEditDistanceRelevanceParams(editDistance, matchSpanLength, patternLength)

    const normDenominator = Math.max(matchSpanLength, patternLength)
    if (normDenominator === 0) {
        return 0
    }

    const normalizedEdit = editDistance / normDenominator
    return 1 - Math.min(1, normalizedEdit)
}

const resolveFlankRelevanceParams = (params: RelevanceNormalizationParams) => ({
    lexAdjoinedFlankMaxDamage: params.lexAdjoinedFlankMaxDamage ?? LEX_ADJOINED_FLANK_MAX_DAMAGE,
    lexRemoteFlankMaxDamage: params.lexRemoteFlankMaxDamage ?? LEX_REMOTE_FLANK_MAX_DAMAGE,
    lexFlankRelevanceK: params.lexFlankRelevanceK ?? LEX_FLANK_RELEVANCE_K,
})

/**
 * Multiplicative lexical relevance from precomputed Sellers + flank metrics.
 *
 * editDistanceRelevance * leftAdjoined * rightAdjoined * nonAdjoinedRemote
 */
export function lexicalRelevanceFromMetrics(
    metrics: LexicalMatchMetrics,
    patternLength: number,
    params: RelevanceNormalizationParams = {}
): number {
    const flankParams = resolveFlankRelevanceParams(params)
    const spanLen = matchSpanLength(metrics.matchSpan)
    const spanScale = Math.max(spanLen, patternLength, 1)

    const editFactor = editDistanceRelevance(metrics.editDistance, spanLen, patternLength)
    const leftAdjoinedFactor = flankLengthRelevance(
        metrics.adjoinedLeftLength,
        spanScale,
        flankParams.lexAdjoinedFlankMaxDamage,
        flankParams.lexFlankRelevanceK
    )
    const rightAdjoinedFactor = flankLengthRelevance(
        metrics.adjoinedRightLength,
        spanScale,
        flankParams.lexAdjoinedFlankMaxDamage,
        flankParams.lexFlankRelevanceK
    )
    const nonAdjoinedFactor = flankLengthRelevance(
        metrics.remoteLeftLength + metrics.remoteRightLength,
        spanScale,
        flankParams.lexRemoteFlankMaxDamage,
        flankParams.lexFlankRelevanceK
    )

    return editFactor * leftAdjoinedFactor * rightAdjoinedFactor * nonAdjoinedFactor
}
