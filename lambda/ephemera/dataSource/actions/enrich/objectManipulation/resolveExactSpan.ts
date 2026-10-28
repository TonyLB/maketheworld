import type { ObjectManipulationCatalogEntry } from './catalogMerge'
import {
    exactCatalogMatches,
    objectManipulationErrorMessageForResolution,
    resolveObjectSpanToObjectId,
} from './resolveObjectSpan'
import type { SpanStructure } from './parse/parseToken'
import {
    catalogScopeToLocus,
    type ObjectSpanCandidate,
    type SpanCandidatePool,
} from './spanResolution'

export type ResolveCatalogSpanToPoolResult =
    | { type: 'pool'; pool: SpanCandidatePool }
    | { type: 'error'; errorMessage: string }
    | { type: 'ineligible' }

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
 * Identify's seam: how one object span becomes a pool. `ineligible` is a resolver declining the span
 * (the full resolver never does); the caller decides what an ineligible span costs.
 */
export type SpanResolver = (
    span: string,
    catalog: readonly ObjectManipulationCatalogEntry[],
    structure?: SpanStructure
) => Promise<ResolveCatalogSpanToPoolResult>

/**
 * The exact piece of resolving a span: an exact unique match (as given, then with a leading article
 * peeled) or ambiguous exact duplicates form an exact pool, and an empty catalog is an error. Returns
 * undefined when the span matches no name exactly, leaving it to a resolver's non-exact piece.
 */
export function resolveExactSpan(
    span: string,
    catalog: readonly ObjectManipulationCatalogEntry[]
): ResolveCatalogSpanToPoolResult | undefined {
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

    return undefined
}
