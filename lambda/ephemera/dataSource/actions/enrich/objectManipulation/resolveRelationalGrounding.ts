import { mergeObjectManipulationCatalogs } from './catalogMerge'
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
 *
 * Grounds against both room and held-inventory catalogs (BD-15/16 slice 4b) ---
 * previously room-only, so a held object's span could never resolve to an id at
 * all, independent of any host/legality question. Reuses `mergeObjectManipulationCatalogs`
 * (already generic, not membership-specific), the same function `compileMembershipAtomic.ts`
 * uses for the identical purpose.
 */
export async function resolveRelationalGrounding(
    command: string,
    subjectSpan: string,
    targetSpan: string,
    roomObjectCatalog: readonly RoomInPlayObjectCatalogEntry[] | undefined,
    heldInventoryCatalog: readonly RoomInPlayObjectCatalogEntry[] | undefined = undefined,
    deps: RelationalGroundingDeps = {}
): Promise<RelationalGroundingResult> {
    void command
    const catalog = mergeObjectManipulationCatalogs(roomObjectCatalog ?? [], heldInventoryCatalog ?? [])
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
