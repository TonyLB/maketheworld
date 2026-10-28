import { buildSpanCandidatePool } from './embeddingMatch/buildSpanCandidatePool'
import { resolveExactSpan, type SpanResolver } from './resolveExactSpan'
import { peelLeadingArticleWhenTail, spanIsNameSubsequence } from './spanMatchForms'

/**
 * The pure resolver: an exact match as the full resolver reads it, else a lexical-only pool over just
 * the names the span is an ordered word subsequence of, else `ineligible`. It never embeds: this module
 * does not reach `internalCache`, so every pool it returns is on the lexical scale alone.
 */
export const resolvePureSpanToPool: SpanResolver = async (span, catalog, structure) => {
    const exact = resolveExactSpan(span, catalog)
    if (exact) {
        return exact
    }
    const matching = catalog.filter(({ normalizedShortName }) => spanIsNameSubsequence(span, normalizedShortName))
    if (matching.length === 0) {
        return { type: 'ineligible' }
    }
    const pool = buildSpanCandidatePool(peelLeadingArticleWhenTail(span), matching, {
        ...(structure !== undefined ? { structure } : {}),
    })
    return { type: 'pool', pool: { ...pool, span } }
}
