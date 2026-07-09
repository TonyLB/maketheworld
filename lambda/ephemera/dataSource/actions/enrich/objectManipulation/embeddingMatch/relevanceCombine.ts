import { clampUnitInterval, sigmoid, tanh } from './evidenceNumerics'
import {
    JOINT_RELEVANCE_W_E,
    JOINT_RELEVANCE_W_L,
    LEX_ADJOINED_FLANK_MAX_DAMAGE,
    LEX_ADJOINED_FLANK_SCALE,
    LEX_ADJOINED_FLANK_WEIGHT,
    LEX_FLANK_COMBINE_BIAS,
    LEX_FLANK_RELEVANCE_K,
    LEX_REMOTE_FLANK_MAX_DAMAGE,
    LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER,
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

type FlankCombineParams = {
    lexFlankCombineBias: number
    lexAdjoinedFlankScale: number
    lexAdjoinedFlankWeight: number
    lexRemoteFlankMidpointMultiplier: number
    lexRemoteFlankScale: number
    lexRemoteFlankWeight: number
    lexAdjoinedFlankMaxDamage: number
    lexRemoteFlankMaxDamage: number
    lexFlankRelevanceK: number
}

const resolveFlankCombineParams = (params: RelevanceNormalizationParams): FlankCombineParams => ({
    lexFlankCombineBias: params.lexFlankCombineBias ?? LEX_FLANK_COMBINE_BIAS,
    lexAdjoinedFlankScale: params.lexAdjoinedFlankScale ?? LEX_ADJOINED_FLANK_SCALE,
    lexAdjoinedFlankWeight: params.lexAdjoinedFlankWeight ?? LEX_ADJOINED_FLANK_WEIGHT,
    lexRemoteFlankMidpointMultiplier: params.lexRemoteFlankMidpointMultiplier ?? LEX_REMOTE_FLANK_MIDPOINT_MULTIPLIER,
    lexRemoteFlankScale: params.lexRemoteFlankScale ?? LEX_REMOTE_FLANK_SCALE,
    lexRemoteFlankWeight: params.lexRemoteFlankWeight ?? LEX_REMOTE_FLANK_WEIGHT,
    lexAdjoinedFlankMaxDamage: params.lexAdjoinedFlankMaxDamage ?? LEX_ADJOINED_FLANK_MAX_DAMAGE,
    lexRemoteFlankMaxDamage: params.lexRemoteFlankMaxDamage ?? LEX_REMOTE_FLANK_MAX_DAMAGE,
    lexFlankRelevanceK: params.lexFlankRelevanceK ?? LEX_FLANK_RELEVANCE_K,
})

/**
 * Production flank combine: sigmoid(bias + sum of centered tanh channel evidence).
 */
export const tanhCenteredFlankScore = (
    metrics: FlankLengthMetrics,
    spanScale: number,
    params: RelevanceNormalizationParams = {}
): number => {
    const combineParams = resolveFlankCombineParams(params)
    const adjoinedMidpoint = spanScale / 2
    const remoteMidpoint = spanScale * combineParams.lexRemoteFlankMidpointMultiplier
    const remoteLength = metrics.remoteLeftLength + metrics.remoteRightLength

    const evidenceLeft = centeredTanhEvidence({
        value: metrics.adjoinedLeftLength,
        midpoint: adjoinedMidpoint,
        scale: combineParams.lexAdjoinedFlankScale,
        weight: combineParams.lexAdjoinedFlankWeight,
    })
    const evidenceRight = centeredTanhEvidence({
        value: metrics.adjoinedRightLength,
        midpoint: adjoinedMidpoint,
        scale: combineParams.lexAdjoinedFlankScale,
        weight: combineParams.lexAdjoinedFlankWeight,
    })
    const evidenceRemote = centeredTanhEvidence({
        value: remoteLength,
        midpoint: remoteMidpoint,
        scale: combineParams.lexRemoteFlankScale,
        weight: combineParams.lexRemoteFlankWeight,
    })

    return sigmoid(
        combineParams.lexFlankCombineBias
        + evidenceLeft
        + evidenceRight
        + evidenceRemote
    )
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
