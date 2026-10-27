/**
 * The lexical factors shared by the cost table (`lexicalWeights.ts`) and the combine
 * (`relevanceCombine.ts`): the flank lengths the combine reads, the edit gate, and the per-flank
 * asymptotic factor of the simulator's multiplicative A/B.
 */

import type { TextRange } from './types'

export type FlankLengthMetrics = {
    adjoinedLeftLength: number
    adjoinedRightLength: number
    remoteLeftLength: number
    remoteRightLength: number
}

export const matchSpanLength = (matchSpan: TextRange): number => (
    matchSpan.end - matchSpan.start
)

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
 * Normalizes the edits inside the match against the longer of the two sides' matches:
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
