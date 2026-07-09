import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import { S_MIN } from './thresholds'

export type AdmissibleShortSpanCatalogEntry = {
    normalizedShortName: string
}

/**
 * Precompute catalog-admissible short spans for lexical channel gating (FT-8).
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
 * Whether the lexical channel is active for this scan.
 * When false, callers must drop w_l from RMS (undefined, not lex=0).
 */
export function isLexicalChannelActive(
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
