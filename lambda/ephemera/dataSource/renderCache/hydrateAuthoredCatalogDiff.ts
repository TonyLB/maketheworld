import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { AuthoredExampleSet } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

import { logCatalogHydrate } from '../catalogHydrateInstrumentation'
import type { EphemeraSituationId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import internalCache from '../../internalCache'
import {
    EPHEMERA_CACHE_PROVENANCE_AUTHORED,
    type EphemeraCacheComponentId,
} from './baseClasses'
import { canDeleteCacheRowOnHydrate, canUpsertCacheRowAtHydrate } from './catalogGuards'
import { deleteCacheRecord } from './deleteCacheRecord'
import { putCacheRecord } from './putCacheRecord'
import { deleteAdjacencyForRemovedSlice, upsertAdjacencyForAuthoredSlice } from './situationAdjacency'
import { authoredExampleToCacheRecord } from './authoredExampleToCacheRecord'

const RENDER_SCOPE = 'renderCache' as const
const PIPELINE = 'hydrateAuthoredCatalogDiff' as const

export type HydrateAuthoredCatalogDiffParams = {
    componentId: EphemeraCacheComponentId;
    perspective: Perspective;
    perspectiveKey: string;
    assetStack: AssetUUID[];
    incomingCatalogVersion: number;
    desiredSet: AuthoredExampleSet;
};

/**
 * Reconcile authored CACHE# rows and Situation adjacency for one (component, perspective) catalog epoch.
 */
export async function hydrateAuthoredCatalogDiff(
    params: HydrateAuthoredCatalogDiffParams
): Promise<void> {
    const {
        componentId,
        perspective,
        perspectiveKey,
        assetStack,
        incomingCatalogVersion,
        desiredSet,
    } = params

    const allRows = await internalCache.RenderCache.getCacheRows(componentId)
    const authoredRows = allRows.filter(
        (row) => row.provenance.type === EPHEMERA_CACHE_PROVENANCE_AUTHORED
    )
    const existingAuthored = authoredRows.filter(
        (row) => row.perspectiveMatcher && perspectiveMatches(row.perspectiveMatcher, perspective)
    )

    const desiredSituationIds = new Set(desiredSet.keys())
    const deletedDataCategories: string[] = []
    let skippedDeleteCount = 0

    for (const row of existingAuthored) {
        const situationId = row.situationId
        if (situationId === undefined || desiredSituationIds.has(situationId)) {
            continue
        }
        if (!canDeleteCacheRowOnHydrate(row.catalogVersion, incomingCatalogVersion)) {
            skippedDeleteCount += 1
            continue
        }
        await deleteCacheRecord(componentId, row.DataCategory)
        deletedDataCategories.push(row.DataCategory)
        await deleteAdjacencyForRemovedSlice({
            situationId: situationId as EphemeraSituationId,
            hostEphemeraId: componentId,
            perspectiveKey,
        })
    }

    if (deletedDataCategories.length > 0) {
        internalCache.RenderCache.deleteCacheRecords(componentId, deletedDataCategories)
    }

    const existingBySituationId = new Map<string, { dataCategory: string; catalogVersion?: number }>()
    for (const row of existingAuthored) {
        if (row.situationId === undefined || existingBySituationId.has(row.situationId)) {
            continue
        }
        existingBySituationId.set(row.situationId, {
            dataCategory: row.DataCategory,
            catalogVersion: row.catalogVersion,
        })
    }

    let upsertedCount = 0
    let skippedUpsertCount = 0

    for (const [situationId, example] of desiredSet) {
        const existing = existingBySituationId.get(situationId)
        if (
            existing !== undefined
            && !canUpsertCacheRowAtHydrate(existing.catalogVersion, incomingCatalogVersion)
        ) {
            skippedUpsertCount += 1
            continue
        }

        const record = authoredExampleToCacheRecord({
            example,
            perspective,
            perspectiveKey,
        })
        await putCacheRecord(
            componentId,
            { ...record, catalogVersion: incomingCatalogVersion },
            existing?.dataCategory
        )
        upsertedCount += 1

        await upsertAdjacencyForAuthoredSlice({
            situationId: situationId as EphemeraSituationId,
            hostEphemeraId: componentId,
            perspectiveKey,
            assetStack,
        })
    }

    logCatalogHydrate(RENDER_SCOPE, 'diff_complete', {
        pipeline: PIPELINE,
        componentId,
        perspectiveKey,
        incomingCatalogVersion,
        desiredSituationCount: desiredSet.size,
        //
        // Counts are reported at each narrowing step so that an unexpected zero can be attributed:
        // `allRowCount` 0 means the CACHE# query itself came back empty; a drop from `allRowCount`
        // to `authoredRowCount` is the provenance filter; a drop to `existingAuthoredRowCount` is
        // perspective matching (in which case the offending inputs are logged below).
        //
        allRowCount: allRows.length,
        authoredRowCount: authoredRows.length,
        existingAuthoredRowCount: existingAuthored.length,
        ...(existingAuthored.length === 0 && authoredRows.length > 0
            ? {
                perspectiveAssetStack: perspective.assetStack,
                sampleAuthoredMatcher: authoredRows[0].perspectiveMatcher,
            }
            : {}),
        deletedCount: deletedDataCategories.length,
        skippedDeleteCount,
        upsertedCount,
        skippedUpsertCount,
    })
}
