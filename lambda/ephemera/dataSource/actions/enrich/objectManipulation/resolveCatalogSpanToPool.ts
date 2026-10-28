import { buildEmbeddedLexicalPool } from './embeddedLexicalPool'
import { resolveExactSpan, type SpanResolver } from './resolveExactSpan'

export { resolveExactSpan }
export type { ResolveCatalogSpanToPoolResult, SpanResolver } from './resolveExactSpan'

/**
 * FT-2.1: the full resolver, one object span to a SpanCandidatePool (evidence artifact).
 * Exact matches short-circuit without embed; non-exact spans rank via the embedded lexical pool.
 */
export const resolveCatalogSpanToPool: SpanResolver = async (span, catalog, structure) => (
    resolveExactSpan(span, catalog) ?? { type: 'pool', pool: await buildEmbeddedLexicalPool(span, catalog, structure) }
)
