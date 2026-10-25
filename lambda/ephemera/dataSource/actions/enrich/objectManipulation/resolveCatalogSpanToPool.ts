import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { buildSpanCandidatePool } from './embeddingMatch/buildSpanCandidatePool'
import { createSpanEmbedCache, getOrEmbedSpan } from './embeddingMatch/spanEmbedCache'
import type { ResolveObjectSpanByEmbeddingDeps } from './embeddingMatch/resolveObjectSpanByEmbedding'
import {
    exactCatalogMatches,
    objectManipulationErrorMessageForResolution,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'
import { peelLeadingArticleWhenTail } from './spanMatchForms'
import {
    catalogScopeToLocus,
    type ObjectSpanCandidate,
    type SpanCandidatePool,
} from './spanResolution'

export type ResolveCatalogSpanToPoolResult =
    | { type: 'pool'; pool: SpanCandidatePool }
    | { type: 'error'; errorMessage: string }

export type ResolveCatalogSpanToPoolDeps = Pick<ResolveObjectSpanByEmbeddingDeps, 'embedSpan'> & {
    spanEmbedCache?: ReturnType<typeof createSpanEmbedCache>
}

const buildExactCandidate = (entry: ObjectManipulationCatalogEntry): ObjectSpanCandidate => ({
    id: entry.objectId,
    label: entry.normalizedShortName,
    jointRelevance: 1,
    marginToRunnerUp: 0,
    sourceTags: ['exact'],
    locus: catalogScopeToLocus(entry.catalogScope),
})

const buildExactSpanCandidatePool = (
    span: string,
    entries: readonly ObjectManipulationCatalogEntry[]
): SpanCandidatePool => {
    const candidates = entries.map((entry) => buildExactCandidate(entry))
    const ranked = [...candidates].sort((left, right) => {
        if (right.jointRelevance !== left.jointRelevance) {
            return right.jointRelevance - left.jointRelevance
        }
        return left.label.localeCompare(right.label)
    })
    const withMargins = ranked.map((candidate, index) => {
        const runnerUp = ranked[index + 1]
        if (!runnerUp) {
            return candidate
        }
        return {
            ...candidate,
            marginToRunnerUp: Math.max(0, candidate.jointRelevance - runnerUp.jointRelevance),
        }
    })
    return {
        span,
        candidates: withMargins,
        shortlist: withMargins.length > 0 ? withMargins : undefined,
    }
}

/**
 * FT-2.1: resolve one object span to a SpanCandidatePool (evidence artifact).
 * Exact unique match (as given, then with a leading article peeled) short-circuits without
 * embed; ambiguous exact duplicates form an exact pool; non-exact spans rank via
 * buildSpanCandidatePool.
 */
export async function resolveCatalogSpanToPool(
    span: string,
    catalog: readonly ObjectManipulationCatalogEntry[],
    deps: ResolveCatalogSpanToPoolDeps = {}
): Promise<ResolveCatalogSpanToPoolResult> {
    const resolution = resolveObjectSpanToObjectId(span, catalog)
    if (resolution.type === 'NoCatalog') {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessageForResolution({ type: 'NoCatalog' }),
        }
    }

    if (resolution.type === 'Resolved') {
        const entry = catalog.find(({ objectId }) => objectId === resolution.objectId)
        if (!entry) {
            return {
                type: 'error',
                errorMessage: objectManipulationErrorMessageForResolution({ type: 'NoMatch' }),
            }
        }
        return {
            type: 'pool',
            pool: buildExactSpanCandidatePool(span, [entry]),
        }
    }

    if (resolution.type === 'AmbiguousMatch') {
        const matches = exactCatalogMatches(span, catalog)
        return {
            type: 'pool',
            pool: buildExactSpanCandidatePool(span, matches),
        }
    }

    // Both channels rank the span with its leading article peeled; the pool keeps the span as given.
    const matchSpan = peelLeadingArticleWhenTail(span)
    const cache = deps.spanEmbedCache ?? createSpanEmbedCache()
    const embedResult = await getOrEmbedSpan(matchSpan, cache, deps)
    const pool = buildSpanCandidatePool(matchSpan, catalog, {
        ...(embedResult.success ? { spanEmbedding: embedResult.embedding } : {}),
    })

    return { type: 'pool', pool: { ...pool, span } }
}
