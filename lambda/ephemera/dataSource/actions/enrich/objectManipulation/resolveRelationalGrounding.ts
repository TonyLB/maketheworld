import { catalogWithScope } from './catalogMerge'
import { createSpanEmbedCache } from './embeddingMatch/spanEmbedCache'
import type { ResolveObjectSpanByEmbeddingDeps } from './embeddingMatch/resolveObjectSpanByEmbedding'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import {
    resolveCatalogSpanToPool,
    type ResolveCatalogSpanToPoolDeps,
} from './resolveCatalogSpanToPool'
import type { SpanCandidatePool } from './spanResolution'

export type RelationalGroundingDeps = ResolveCatalogSpanToPoolDeps &
    Pick<ResolveObjectSpanByEmbeddingDeps, 'embedSpan'>

export type RelationalGroundingResult =
    | {
          type: 'success'
          subjectPool: SpanCandidatePool
          targetPool: SpanCandidatePool
      }
    | { type: 'error'; errorMessage: string }

/**
 * Emit subject + target SpanCandidatePool artifacts (FT-3.3).
 * Selection / Consult / Abstain live in selectRelationalFromPools.
 */
export async function resolveRelationalGrounding(
    command: string,
    subjectSpan: string,
    targetSpan: string,
    roomObjectCatalog: readonly RoomInPlayObjectCatalogEntry[] | undefined,
    deps: RelationalGroundingDeps = {}
): Promise<RelationalGroundingResult> {
    void command
    const catalog = catalogWithScope(roomObjectCatalog ?? [], 'room')
    const spanEmbedCache = deps.spanEmbedCache ?? createSpanEmbedCache()
    const poolDeps: ResolveCatalogSpanToPoolDeps = { ...deps, spanEmbedCache }

    const subjectPoolResult = await resolveCatalogSpanToPool(subjectSpan, catalog, poolDeps)
    if (subjectPoolResult.type === 'error') {
        return subjectPoolResult
    }

    const targetPoolResult = await resolveCatalogSpanToPool(targetSpan, catalog, poolDeps)
    if (targetPoolResult.type === 'error') {
        return targetPoolResult
    }

    return {
        type: 'success',
        subjectPool: subjectPoolResult.pool,
        targetPool: targetPoolResult.pool,
    }
}
