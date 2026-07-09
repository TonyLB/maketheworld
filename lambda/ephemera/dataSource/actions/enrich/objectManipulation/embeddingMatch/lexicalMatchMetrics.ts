import {
    sellersApproximateSubstringMatch,
    type SellersMatchSpan,
} from './sellersApproximateSubstringMatch'

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
