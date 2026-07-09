import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import {
    sellersApproximateSubstringMatch,
    type SellersApproximateSubstringMatch,
    type SellersMatchSpan,
} from './sellersApproximateSubstringMatch'
import {
    computeLexicalMatchMetrics,
    deriveFlankLengthMetrics,
    lexicalRelevanceFromMetrics,
    type FlankLengthMetrics,
    type LexicalMatchMetrics,
} from './lexicalMatchMetrics'
import {
    L_MIN,
    LEX_FLANK_MODERATE_COST,
    LEX_FLANK_STRONG_COST,
    LEX_MATCH_SUBSTITUTION_COST,
    type RelevanceNormalizationParams,
} from './thresholds'

export {
    sellersApproximateSubstringMatch,
    type SellersApproximateSubstringMatch,
    type SellersMatchSpan,
    computeLexicalMatchMetrics,
    lexicalRelevanceFromMetrics,
    type LexicalMatchMetrics,
    deriveFlankLengthMetrics,
    type FlankLengthMetrics,
}

/**
 * FT-8 lexical relevance entry point.
 *
 * Embeds the shorter normalized string in the longer (span vs catalog shortName), runs Sellers
 * alignment, then multiplies four independent [0, 1] factors from lexicalMatchMetrics:
 * edit distance (hard gate), left/right adjoined flanks, and combined remote flank material.
 *
 * Legacy substringBiasedEditDistance below is retained for simulator A/B only.
 */
export function lexicalRelevance(
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
    return lexicalRelevanceFromMetrics(metrics, pattern.length, params)
}

const isAlpha = (char: string | undefined): boolean => (
    char !== undefined && /[a-z0-9]/i.test(char)
)

/**
 * True when the boundary between left and right is non-alpha (space, hyphen, etc.)
 * or at start/end of string.
 */
export function isAlphaBoundary(leftChar: string | undefined, rightChar: string | undefined): boolean {
    return !isAlpha(leftChar) || !isAlpha(rightChar)
}

type LexicalCostParams = {
    lexFlankStrongCost: number
    lexFlankModerateCost: number
    lexMatchSubstitutionCost: number
}

export type SubstringAlignmentCost = {
    /** Substitutions / insertions inside the embedded match window. */
    matchCost: number
    /** Prefix/suffix edits on the longer string around the match. */
    flankCost: number
}

const resolveLexicalCostParams = (params: RelevanceNormalizationParams): LexicalCostParams => ({
    lexFlankStrongCost: params.lexFlankStrongCost ?? LEX_FLANK_STRONG_COST,
    lexFlankModerateCost: params.lexFlankModerateCost ?? LEX_FLANK_MODERATE_COST,
    lexMatchSubstitutionCost: params.lexMatchSubstitutionCost ?? LEX_MATCH_SUBSTITUTION_COST,
})

/**
 * Cost to delete/insert a flank segment in longer.
 * Strong discount at non-alpha boundaries or whole-token prefix/suffix in multi-token names.
 */
const flankSegmentCost = (
    flank: string,
    adjacentToMatch: 'left' | 'right',
    longer: string,
    matchStart: number,
    matchEnd: number,
    costParams: LexicalCostParams
): number => {
    if (flank.length === 0) {
        return 0
    }

    const { lexFlankStrongCost, lexFlankModerateCost } = costParams
    const tokens = longer.split(' ')
    const isMultiToken = tokens.length > 1

    // Whole-token prefix in multi-token shortName (e.g. "rusty " before "ax" in "rusty ax").
    if (adjacentToMatch === 'left' && isMultiToken) {
        const prefix = longer.slice(0, matchStart)
        const prefixTokens = prefix.split(' ').filter((token) => token.length > 0)
        const matchToken = longer.slice(matchStart, matchEnd)
        const tokenAtMatch = tokens.find((token) => token === matchToken)
        if (tokenAtMatch !== undefined && prefixTokens.length > 0) {
            return lexFlankStrongCost
        }
    }

    // Whole-token suffix in multi-token shortName.
    if (adjacentToMatch === 'right' && isMultiToken) {
        const suffix = longer.slice(matchEnd)
        const suffixTokens = suffix.split(' ').filter((token) => token.length > 0)
        if (suffixTokens.length === 1 && suffix.startsWith(' ')) {
            return lexFlankStrongCost
        }
    }

    const boundaryChar = adjacentToMatch === 'left'
        ? longer[matchStart - 1]
        : longer[matchEnd]
    const matchEdgeChar = adjacentToMatch === 'left'
        ? longer[matchStart]
        : longer[matchEnd - 1]

    if (isAlphaBoundary(boundaryChar, matchEdgeChar)) {
        return lexFlankStrongCost * flank.length
    }

    return lexFlankModerateCost * flank.length
}

const exactSubstringAlignmentCost = (
    longer: string,
    shorter: string,
    matchStart: number,
    costParams: LexicalCostParams
): SubstringAlignmentCost => {
    const matchEnd = matchStart + shorter.length
    const leftFlank = longer.slice(0, matchStart)
    const rightFlank = longer.slice(matchEnd)

    return {
        matchCost: 0,
        flankCost: (
            flankSegmentCost(leftFlank, 'left', longer, matchStart, matchEnd, costParams)
            + flankSegmentCost(rightFlank, 'right', longer, matchStart, matchEnd, costParams)
        ),
    }
}

export const normalizedSubstringAlignmentDistance = (
    { matchCost, flankCost }: SubstringAlignmentCost,
    shorterLength: number,
    longerLength: number,
    lMin: number
): number => {
    const shorterDenom = Math.max(shorterLength, lMin)
    if (matchCost === 0) {
        // Wrapper / exact embed: flank edits live on the longer side only.
        return flankCost / Math.max(longerLength, lMin)
    }
    // In-window typos: keep proportional penalty on the shorter side (FT-8 L_min intent).
    return (matchCost + flankCost) / shorterDenom
}

/**
 * Legacy FT-1.1 substring-biased edit distance (simulator A/B baseline).
 * Production lexicalRelevance uses Sellers + multiplicative factors in lexicalMatchMetrics.
 */
export function substringBiasedEditDistance(
    span: string,
    shortName: string,
    params: RelevanceNormalizationParams = {}
): number {
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const normalizedShortName = normalizeShortNameForEmbedding(shortName)
    const lMin = params.lMin ?? L_MIN

    if (normalizedSpan.length === 0 || normalizedShortName.length === 0) {
        return Infinity
    }

    const costParams = resolveLexicalCostParams(params)
    const [shorter, longer] = normalizedSpan.length <= normalizedShortName.length
        ? [normalizedSpan, normalizedShortName]
        : [normalizedShortName, normalizedSpan]

    let bestCost: SubstringAlignmentCost | undefined

    const considerAlignment = (cost: SubstringAlignmentCost) => {
        const rawTotal = cost.matchCost + cost.flankCost
        const bestRawTotal = bestCost === undefined
            ? Infinity
            : bestCost.matchCost + bestCost.flankCost
        if (rawTotal < bestRawTotal) {
            bestCost = cost
        }
    }

    // Exact contiguous substring alignments.
    let searchFrom = 0
    while (searchFrom <= longer.length - shorter.length) {
        const index = longer.indexOf(shorter, searchFrom)
        if (index === -1) {
            break
        }
        considerAlignment(exactSubstringAlignmentCost(longer, shorter, index, costParams))
        searchFrom = index + 1
    }

    // In-window typo tolerance: align shorter against each window of equal length in longer.
    const { lexMatchSubstitutionCost } = costParams
    for (let windowStart = 0; windowStart <= longer.length - shorter.length; windowStart += 1) {
        const window = longer.slice(windowStart, windowStart + shorter.length)
        let substitutionCost = 0
        for (let i = 0; i < shorter.length; i += 1) {
            if (shorter[i] !== window[i]) {
                substitutionCost += lexMatchSubstitutionCost
            }
        }
        if (substitutionCost === 0) {
            continue
        }
        const matchStart = windowStart
        const matchEnd = windowStart + shorter.length
        const leftFlank = longer.slice(0, matchStart)
        const rightFlank = longer.slice(matchEnd)
        considerAlignment({
            matchCost: substitutionCost,
            flankCost: (
                flankSegmentCost(leftFlank, 'left', longer, matchStart, matchEnd, costParams)
                + flankSegmentCost(rightFlank, 'right', longer, matchStart, matchEnd, costParams)
            ),
        })
    }

    if (bestCost === undefined) {
        return Infinity
    }

    return normalizedSubstringAlignmentDistance(
        bestCost,
        shorter.length,
        longer.length,
        lMin
    )
}
