import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { catalogWithScope } from './catalogMerge'
import { createSpanEmbedCache } from './embeddingMatch/spanEmbedCache'
import type { ResolveObjectSpanByEmbeddingDeps } from './embeddingMatch/resolveObjectSpanByEmbedding'
import type { RoomInPlayObjectCatalogEntry } from '../../roomObjectCatalogForCharacter'
import {
    resolveCatalogSpanToPool,
    type ResolveCatalogSpanToPoolDeps,
} from './resolveCatalogSpanToPool'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    resolvedObjectIdFromSpanOutcome,
    selectSingleSpanFromPool,
    spanResolutionErrorReason,
} from './selectSingleSpanFromPool'
import type { SpanCandidatePool } from './spanResolution'

export type RelationalGroundingDeps = ResolveCatalogSpanToPoolDeps &
    Pick<ResolveObjectSpanByEmbeddingDeps, 'embedSpan'>

export type RelationalGroundingResult =
    | {
          type: 'success'
          subjectPool: SpanCandidatePool
          targetPool: SpanCandidatePool
          subjectId: EphemeraObjectId
          targetId: EphemeraObjectId
      }
    | { type: 'error'; errorMessage: string }

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

    const subjectOutcome = selectSingleSpanFromPool(subjectPoolResult.pool)
    if (subjectOutcome.verdict !== 'resolved') {
        return { type: 'error', errorMessage: spanResolutionErrorReason(subjectOutcome) }
    }

    const targetOutcome = selectSingleSpanFromPool(targetPoolResult.pool)
    if (targetOutcome.verdict !== 'resolved') {
        return { type: 'error', errorMessage: spanResolutionErrorReason(targetOutcome) }
    }

    const subjectId = resolvedObjectIdFromSpanOutcome(subjectOutcome)!
    const targetId = resolvedObjectIdFromSpanOutcome(targetOutcome)!

    if (subjectId === targetId) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.sameSubjectAndTarget,
        }
    }

    return {
        type: 'success',
        subjectPool: subjectPoolResult.pool,
        targetPool: targetPoolResult.pool,
        subjectId,
        targetId,
    }
}
