import internalCache from '../../../../internalCache'
import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { buildSpanCandidatePool } from './embeddingMatch/buildSpanCandidatePool'
import type { SpanStructure } from './parse/parseToken'
import { peelLeadingArticleWhenTail } from './spanMatchForms'
import type { SpanCandidatePool } from './spanResolution'

/**
 * A non-exact span's pool: the lexical channel blended with the span's embedding. Both channels rank
 * the span with its leading article peeled (the embed handler peels its own key); the pool keeps the
 * span as given. This is the one place Identify embeds, so a resolver that never imports it cannot.
 */
export async function buildEmbeddedLexicalPool(
    span: string,
    catalog: readonly ObjectManipulationCatalogEntry[],
    structure?: SpanStructure
): Promise<SpanCandidatePool> {
    const matchSpan = peelLeadingArticleWhenTail(span)
    const embedResult = await internalCache.SpanEmbeddings.get(span)
    const pool = buildSpanCandidatePool(matchSpan, catalog, {
        ...(embedResult.success ? { spanEmbedding: embedResult.embedding } : {}),
        ...(structure !== undefined ? { structure } : {}),
    })
    return { ...pool, span }
}
