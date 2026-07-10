import { normalizeExitName } from '../../roomExitTargetsForCharacter'

import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import { buildSpanCandidatePool } from './embeddingMatch/buildSpanCandidatePool'
import { createSpanEmbedCache, getOrEmbedSpan } from './embeddingMatch/spanEmbedCache'
import type { ResolveObjectSpanByEmbeddingDeps } from './embeddingMatch/resolveObjectSpanByEmbedding'
import {
    objectManipulationErrorMessageForResolution,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'
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

const matchingCatalogEntries = (
    rawObjectSpan: string,
    catalog: readonly ObjectManipulationCatalogEntry[]
): ObjectManipulationCatalogEntry[] => {
    const normalizedCandidate = normalizeExitName(rawObjectSpan)
    if (!normalizedCandidate) {
        return []
    }
    return catalog.filter(
        ({ normalizedShortName }) => normalizedShortName === normalizedCandidate
    )
}

/**
 * FT-2.1: resolve one object span to a SpanCandidatePool (evidence artifact).
 * Exact unique match short-circuits without embed; ambiguous exact duplicates and
 * non-exact spans rank via buildSpanCandidatePool.
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
        const matches = matchingCatalogEntries(span, catalog)
        return {
            type: 'pool',
            pool: buildExactSpanCandidatePool(span, matches),
        }
    }

    const cache = deps.spanEmbedCache ?? createSpanEmbedCache()
    const embedResult = await getOrEmbedSpan(span, cache, deps)
    const pool = buildSpanCandidatePool(span, catalog, {
        ...(embedResult.success ? { spanEmbedding: embedResult.embedding } : {}),
    })

    return { type: 'pool', pool }
}
