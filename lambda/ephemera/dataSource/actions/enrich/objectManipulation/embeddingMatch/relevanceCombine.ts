import { clampUnitInterval, sigmoid, tanh } from './evidenceNumerics'
import {
    JOINT_RELEVANCE_W_E,
    JOINT_RELEVANCE_W_L,
    LEX_ADJOINED_FLANK_MAX_DAMAGE,
    LEX_ADJOINED_FLANK_SCALE,
    LEX_ADJOINED_FLANK_WEIGHT,
    LEX_ADJOINED_FLANK_MIDPOINT_RATIO,
    LEX_ADJOINED_POS_DAMP_SCALE,
    LEX_BIAS_COVERAGE_SCALE,
    LEX_FLANK_COMBINE_BIAS,
    LEX_FLANK_COMBINE_BIAS_MIN,
    LEX_FLANK_RELEVANCE_K,
    LEX_REMOTE_FLANK_MAX_DAMAGE,
    LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER,
    LEX_REMOTE_FLANK_MIDPOINT_RATIO,
    LEX_REMOTE_FLANK_SCALE,
    LEX_REMOTE_FLANK_WEIGHT,
    type RelevanceNormalizationParams,
} from './thresholds'
import type { FlankLengthMetrics } from './lexicalMatchMetrics'

export type WeightedRmsJointRelevanceInput = {
    lex?: number
    embed?: number
}

/**
 * FT-1.2 weighted RMS joint relevance (soft-OR).
 * Absent channels are undefined --- dropped from numerator and weight sum, not plugged as 0.
 */
export const weightedRmsJointRelevance = (
    input: WeightedRmsJointRelevanceInput,
    params: RelevanceNormalizationParams = {}
): number => {
    const w_l = params.jointRelevanceWL ?? JOINT_RELEVANCE_W_L
    const w_e = params.jointRelevanceWE ?? JOINT_RELEVANCE_W_E
    const { lex, embed } = input

    if (lex !== undefined && embed !== undefined) {
        if (!Number.isFinite(lex) || !Number.isFinite(embed)) {
            throw new Error('weightedRmsJointRelevance: lex and embed must be finite when both present')
        }
        if (!Number.isFinite(w_l) || w_l <= 0 || !Number.isFinite(w_e) || w_e <= 0) {
            throw new Error('weightedRmsJointRelevance: w_l and w_e must be finite numbers > 0')
        }
        const numerator = w_l * lex * lex + w_e * embed * embed
        const denominator = w_l + w_e
        return clampUnitInterval(Math.sqrt(numerator / denominator))
    }

    if (lex !== undefined) {
        if (!Number.isFinite(lex)) {
            throw new Error('weightedRmsJointRelevance: lex must be finite when present')
        }
        return clampUnitInterval(lex)
    }

    if (embed !== undefined) {
        if (!Number.isFinite(embed)) {
            throw new Error('weightedRmsJointRelevance: embed must be finite when present')
        }
        return clampUnitInterval(embed)
    }

    return 0
}

export type CenteredTanhEvidenceInput = {
    value: number
    midpoint: number
    scale: number
    weight: number
}

/**
 * Bounded channel evidence: w * tanh((m - x) / s).
 * x = 0 is better than neutral; x = m is neutral; large x saturates negative.
 */
export const centeredTanhEvidence = ({
    value,
    midpoint,
    scale,
    weight,
}: CenteredTanhEvidenceInput): number => {
    if (!Number.isFinite(scale) || scale <= 0) {
        throw new Error('centeredTanhEvidence: scale must be a finite number > 0')
    }
    const t = (midpoint - value) / scale
    return weight * tanh(t)
}

export type FlankCombineContext = {
    patternLength: number
    candidateTextLength: number
}

type ShortSpanMitigationParams = {
    lexFlankCombineBiasMin: number
    lexFlankCombineBiasMax: number
    lexBiasCoverageScale: number
    lexAdjoinedPosDampScale: number
}

const resolveShortSpanMitigationParams = (
    params: RelevanceNormalizationParams
): ShortSpanMitigationParams => ({
    lexFlankCombineBiasMin: params.lexFlankCombineBiasMin ?? LEX_FLANK_COMBINE_BIAS_MIN,
    lexFlankCombineBiasMax: params.lexFlankCombineBias ?? LEX_FLANK_COMBINE_BIAS,
    lexBiasCoverageScale: params.lexBiasCoverageScale ?? LEX_BIAS_COVERAGE_SCALE,
    lexAdjoinedPosDampScale: params.lexAdjoinedPosDampScale ?? LEX_ADJOINED_POS_DAMP_SCALE,
})

/**
 * FT-1.3.2: normalized lift from embed coverage in (0, 1].
 */
export const coverageLiftFromEmbed = (
    coverage: number,
    params: RelevanceNormalizationParams = {}
): number => {
    const { lexBiasCoverageScale } = resolveShortSpanMitigationParams(params)
    if (!Number.isFinite(coverage) || coverage <= 0) {
        return 0
    }
    const clampedCoverage = Math.min(1, coverage)
    const numerator = tanh(lexBiasCoverageScale * clampedCoverage)
    const denominator = tanh(lexBiasCoverageScale)
    if (denominator === 0) {
        return 0
    }
    return numerator / denominator
}

/**
 * FT-1.3.2: interpolate outer sigmoid bias from embed coverage.
 */
export const effectiveFlankCombineBias = (
    patternLength: number,
    candidateTextLength: number,
    params: RelevanceNormalizationParams = {}
): number => {
    if (candidateTextLength <= 0 || patternLength <= 0) {
        return resolveShortSpanMitigationParams(params).lexFlankCombineBiasMin
    }
    const coverage = patternLength / candidateTextLength
    const lift = coverageLiftFromEmbed(coverage, params)
    const mitigation = resolveShortSpanMitigationParams(params)
    return (
        mitigation.lexFlankCombineBiasMin
        + (mitigation.lexFlankCombineBiasMax - mitigation.lexFlankCombineBiasMin) * lift
    )
}

/**
 * FT-1.3.2: damp positive adjoined evidence for short patterns; negatives at full weight.
 */
export const centeredTanhEvidenceAdjoinedPositiveDamped = (
    input: CenteredTanhEvidenceInput,
    patternLength: number,
    params: RelevanceNormalizationParams = {}
): number => {
    const raw = centeredTanhEvidence(input)
    if (raw <= 0) {
        return raw
    }
    const { lexAdjoinedPosDampScale } = resolveShortSpanMitigationParams(params)
    const positiveDamp = tanh(patternLength / lexAdjoinedPosDampScale)
    return raw * positiveDamp
}

type FlankCombineParams = {
    lexFlankCombineBias: number
    lexAdjoinedFlankMidpointRatio: number
    lexAdjoinedFlankScale: number
    lexAdjoinedFlankWeight: number
    lexRemoteFlankMidpointMultiplier: number
    lexRemoteFlankMidpointRatio: number
    lexRemoteFlankScale: number
    lexRemoteFlankWeight: number
    lexAdjoinedFlankMaxDamage: number
    lexRemoteFlankMaxDamage: number
    lexFlankRelevanceK: number
}

const resolveFlankCombineParams = (params: RelevanceNormalizationParams): FlankCombineParams => ({
    lexFlankCombineBias: params.lexFlankCombineBias ?? LEX_FLANK_COMBINE_BIAS,
    lexAdjoinedFlankMidpointRatio: params.lexAdjoinedFlankMidpointRatio ?? LEX_ADJOINED_FLANK_MIDPOINT_RATIO,
    lexAdjoinedFlankScale: params.lexAdjoinedFlankScale ?? LEX_ADJOINED_FLANK_SCALE,
    lexAdjoinedFlankWeight: params.lexAdjoinedFlankWeight ?? LEX_ADJOINED_FLANK_WEIGHT,
    lexRemoteFlankMidpointMultiplier: params.lexRemoteFlankMidpointMultiplier ?? LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER,
    lexRemoteFlankMidpointRatio: params.lexRemoteFlankMidpointRatio ?? LEX_REMOTE_FLANK_MIDPOINT_RATIO,
    lexRemoteFlankScale: params.lexRemoteFlankScale ?? LEX_REMOTE_FLANK_SCALE,
    lexRemoteFlankWeight: params.lexRemoteFlankWeight ?? LEX_REMOTE_FLANK_WEIGHT,
    lexAdjoinedFlankMaxDamage: params.lexAdjoinedFlankMaxDamage ?? LEX_ADJOINED_FLANK_MAX_DAMAGE,
    lexRemoteFlankMaxDamage: params.lexRemoteFlankMaxDamage ?? LEX_REMOTE_FLANK_MAX_DAMAGE,
    lexFlankRelevanceK: params.lexFlankRelevanceK ?? LEX_FLANK_RELEVANCE_K,
})

const adjoinedEvidenceInput = (
    adjoinedLength: number,
    spanScale: number,
    combineParams: FlankCombineParams,
    useRatioInvariant: boolean
): CenteredTanhEvidenceInput => {
    const safeSpanScale = Math.max(spanScale, 1)
    if (useRatioInvariant) {
        return {
            value: adjoinedLength / safeSpanScale,
            midpoint: combineParams.lexAdjoinedFlankMidpointRatio,
            scale: combineParams.lexAdjoinedFlankScale,
            weight: combineParams.lexAdjoinedFlankWeight,
        }
    }
    return {
        value: adjoinedLength,
        midpoint: safeSpanScale / 2,
        scale: combineParams.lexAdjoinedFlankScale,
        weight: combineParams.lexAdjoinedFlankWeight,
    }
}

const remoteEvidenceInput = (
    remoteLength: number,
    spanScale: number,
    combineParams: FlankCombineParams,
    useRatioInvariant: boolean
): CenteredTanhEvidenceInput => {
    const safeSpanScale = Math.max(spanScale, 1)
    if (useRatioInvariant) {
        return {
            value: remoteLength / safeSpanScale,
            midpoint: combineParams.lexRemoteFlankMidpointRatio,
            scale: combineParams.lexRemoteFlankScale,
            weight: combineParams.lexRemoteFlankWeight,
        }
    }
    return {
        value: remoteLength,
        midpoint: safeSpanScale * combineParams.lexRemoteFlankMidpointMultiplier,
        scale: combineParams.lexRemoteFlankScale,
        weight: combineParams.lexRemoteFlankWeight,
    }
}

/**
 * Production flank combine: sigmoid(bias + sum of centered tanh channel evidence).
 * When context is omitted, uses legacy constant bias and absolute flank channels.
 * When context is present, adjoined L/R and remote use ratio-invariant lengths vs spanScale (FT-1.3.3/4).
 */
export const tanhCenteredFlankScore = (
    metrics: FlankLengthMetrics,
    spanScale: number,
    params: RelevanceNormalizationParams = {},
    context?: FlankCombineContext
): number => {
    const combineParams = resolveFlankCombineParams(params)
    const safeSpanScale = Math.max(spanScale, 1)
    const remoteLength = metrics.remoteLeftLength + metrics.remoteRightLength
    const useRatioInvariant = context !== undefined

    const adjoinedInputLeft = adjoinedEvidenceInput(
        metrics.adjoinedLeftLength,
        safeSpanScale,
        combineParams,
        useRatioInvariant
    )
    const adjoinedInputRight = adjoinedEvidenceInput(
        metrics.adjoinedRightLength,
        safeSpanScale,
        combineParams,
        useRatioInvariant
    )
    const remoteInput = remoteEvidenceInput(
        remoteLength,
        safeSpanScale,
        combineParams,
        useRatioInvariant
    )

    const evidenceLeft = context
        ? centeredTanhEvidenceAdjoinedPositiveDamped(
            adjoinedInputLeft,
            context.patternLength,
            params
        )
        : centeredTanhEvidence(adjoinedInputLeft)
    const evidenceRight = context
        ? centeredTanhEvidenceAdjoinedPositiveDamped(
            adjoinedInputRight,
            context.patternLength,
            params
        )
        : centeredTanhEvidence(adjoinedInputRight)
    const evidenceRemote = centeredTanhEvidence(remoteInput)

    const bias = context
        ? effectiveFlankCombineBias(
            context.patternLength,
            context.candidateTextLength,
            params
        )
        : combineParams.lexFlankCombineBias

    return sigmoid(bias + evidenceLeft + evidenceRight + evidenceRemote)
}

const asymptoticFlankFactor = (
    flankLength: number,
    spanScale: number,
    maxDamage: number,
    k: number
): number => {
    const scaledLength = flankLength / spanScale
    return 1 - maxDamage * (1 - Math.exp(-k * scaledLength))
}

/**
 * Simulator A/B baseline: multiplicative product of asymptotic flank factors (FT-1.1 v1).
 */
export const multiplicativeFlankScoreV1 = (
    metrics: FlankLengthMetrics,
    spanScale: number,
    params: RelevanceNormalizationParams = {}
): number => {
    const combineParams = resolveFlankCombineParams(params)
    const leftAdjoinedFactor = asymptoticFlankFactor(
        metrics.adjoinedLeftLength,
        spanScale,
        combineParams.lexAdjoinedFlankMaxDamage,
        combineParams.lexFlankRelevanceK
    )
    const rightAdjoinedFactor = asymptoticFlankFactor(
        metrics.adjoinedRightLength,
        spanScale,
        combineParams.lexAdjoinedFlankMaxDamage,
        combineParams.lexFlankRelevanceK
    )
    const nonAdjoinedFactor = asymptoticFlankFactor(
        metrics.remoteLeftLength + metrics.remoteRightLength,
        spanScale,
        combineParams.lexRemoteFlankMaxDamage,
        combineParams.lexFlankRelevanceK
    )

    return leftAdjoinedFactor * rightAdjoinedFactor * nonAdjoinedFactor
}
