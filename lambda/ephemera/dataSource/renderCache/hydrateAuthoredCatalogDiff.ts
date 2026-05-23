import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { AuthoredExampleSet } from '@tonylb/mtw-gateways/ts/assets/components/componentExamples'
import { perspectiveMatches, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'

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
    const existingAuthored = allRows.filter(
        (row) =>
            row.provenance.type === EPHEMERA_CACHE_PROVENANCE_AUTHORED
            && row.perspectiveMatcher
            && perspectiveMatches(row.perspectiveMatcher, perspective)
    )

    const desiredSituationIds = new Set(desiredSet.keys())
    const deletedDataCategories: string[] = []

    for (const row of existingAuthored) {
        const situationId = row.situationId
        if (situationId === undefined || desiredSituationIds.has(situationId)) {
            continue
        }
        if (!canDeleteCacheRowOnHydrate(row.catalogVersion, incomingCatalogVersion)) {
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

    for (const [situationId, example] of desiredSet) {
        const existing = existingBySituationId.get(situationId)
        if (
            existing !== undefined
            && !canUpsertCacheRowAtHydrate(existing.catalogVersion, incomingCatalogVersion)
        ) {
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

        await upsertAdjacencyForAuthoredSlice({
            situationId: situationId as EphemeraSituationId,
            hostEphemeraId: componentId,
            perspectiveKey,
            assetStack,
        })
    }
}
