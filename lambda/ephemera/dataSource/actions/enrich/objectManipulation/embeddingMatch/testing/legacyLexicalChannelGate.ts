import { normalizeShortNameForEmbedding } from '../../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import type { EmbeddingMatchCandidate } from '../types'
import { S_MIN, type RelevanceNormalizationParams } from '../thresholds'

export type AdmissibleShortSpanCatalogEntry = {
    normalizedShortName: string
}

/**
 * Precompute catalog-admissible short spans (FT-8 legacy gate --- harness baseline only).
 * Whole tokens only --- alpha-prefixes inside tokens are not admitted.
 */
export function buildAdmissibleShortSpans(
    catalog: readonly AdmissibleShortSpanCatalogEntry[],
    sMin: number = S_MIN
): ReadonlySet<string> {
    const admissible = new Set<string>()

    for (const entry of catalog) {
        const normalized = normalizeShortNameForEmbedding(entry.normalizedShortName)
        if (normalized.length === 0) {
            continue
        }
        if (normalized.length < sMin) {
            admissible.add(normalized)
        }
        for (const token of normalized.split(' ')) {
            if (token.length > 0 && token.length < sMin) {
                admissible.add(token)
            }
        }
    }

    return admissible
}

/**
 * Legacy gated policy (pre-FT-1.3.1 production): length-1 inactive; length 2..S_min-1
 * catalog-admitted only. Used as retirement harness baseline, not production.
 */
export function isLegacyLexicalChannelActive(
    normalizedSpan: string,
    admissibleShortSpans: ReadonlySet<string>,
    sMin: number = S_MIN
): boolean {
    const span = normalizeShortNameForEmbedding(normalizedSpan)
    const length = span.length

    if (length === 0) {
        return false
    }
    if (length === 1) {
        return false
    }
    if (length >= sMin) {
        return true
    }
    return admissibleShortSpans.has(span)
}

/** Harness resolver: pre-FT-1.3.1 catalog-derived short-span gate. */
export const resolveLegacyLexicalChannelActive = (
    normalizedSpan: string,
    candidates: readonly EmbeddingMatchCandidate[],
    params: RelevanceNormalizationParams
): boolean => {
    const sMin = params.sMin ?? S_MIN
    const admissibleShortSpans = buildAdmissibleShortSpans(
        candidates.map(({ normalizedShortName }) => ({ normalizedShortName })),
        sMin
    )
    return isLegacyLexicalChannelActive(normalizedSpan, admissibleShortSpans, sMin)
}
