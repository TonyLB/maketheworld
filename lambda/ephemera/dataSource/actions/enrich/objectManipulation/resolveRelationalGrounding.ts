import { mergeObjectManipulationCatalogs } from './catalogMerge'
import type { ResolveObjectSpanByEmbeddingDeps } from './embeddingMatch/resolveObjectSpanByEmbedding'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import { runIdentityStage } from './identityStage'
import type { ResolveCatalogSpanToPoolDeps } from './resolveCatalogSpanToPool'
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
 *
 * Delegates to `runIdentityStage` (BD-20, 2026-07-17) rather than hand-rolling its
 * own two-call sequence over `resolveCatalogSpanToPool` --- Identify is a uniform
 * per-span-list resolver with no subject/target concept of its own; the roles are
 * attached here, positionally, over its plain `spanPools` output.
 */
export async function resolveRelationalGrounding(
    command: string,
    subjectSpan: string,
    targetSpan: string,
    roomObjectCatalog: readonly RoomInPlayObjectCatalogEntry[] | undefined,
    heldInventoryCatalog: readonly RoomInPlayObjectCatalogEntry[] | undefined = undefined,
    deps: RelationalGroundingDeps = {}
): Promise<RelationalGroundingResult> {
    const catalog = mergeObjectManipulationCatalogs(roomObjectCatalog ?? [], heldInventoryCatalog ?? [])
    const identityResult = await runIdentityStage(command, [subjectSpan, targetSpan], catalog, deps)
    if (identityResult.type === 'error') {
        return identityResult
    }

    const [subjectPool, targetPool] = identityResult.spanPools
    return { type: 'success', subjectPool: subjectPool!, targetPool: targetPool! }
}
