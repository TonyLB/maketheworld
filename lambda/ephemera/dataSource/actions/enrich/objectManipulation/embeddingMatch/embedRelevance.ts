import { C_MAX, C_MIN, type RelevanceNormalizationParams } from './thresholds'

const clampUnitInterval = (value: number): number => (
    Math.min(1, Math.max(0, value))
)

/**
 * FT-8 embedding relevance: two-point log map on raw cosine similarity.
 * Absolute / globally parametric --- never within-candidate-set rescale.
 */
export function embedRelevance(
    cosine: number,
    params: RelevanceNormalizationParams = {}
): number {
    const cMin = params.cMin ?? C_MIN
    const cMax = params.cMax ?? C_MAX

    if (!Number.isFinite(cosine) || cosine <= cMin) {
        return 0
    }
    if (cosine >= cMax) {
        return 1
    }

    const numerator = Math.log(cosine / cMin)
    const denominator = Math.log(cMax / cMin)
    return clampUnitInterval(numerator / denominator)
}
