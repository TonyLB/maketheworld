import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

import { S_MIN } from './thresholds'

export type LexicalChannelPolicy = 'legacy' | 'narrowed' | 'alwaysActive'

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
 *
 * FT-1.3.1 policies:
 * - legacy: length-1 always inactive (pre-FT-1.3.1 gate)
 * - narrowed (production default): length-1 active; length 2..S_min-1 catalog-admitted only
 * - alwaysActive: every non-empty span (harness / experiment only)
 */
export function isLexicalChannelActive(
    normalizedSpan: string,
    admissibleShortSpans: ReadonlySet<string>,
    sMin: number = S_MIN,
    policy: LexicalChannelPolicy = 'narrowed'
): boolean {
    const span = normalizeShortNameForEmbedding(normalizedSpan)
    const length = span.length

    if (length === 0) {
        return false
    }
    if (policy === 'alwaysActive') {
        return true
    }
    if (length === 1) {
        return policy === 'narrowed'
    }
    if (length >= sMin) {
        return true
    }
    return admissibleShortSpans.has(span)
}
