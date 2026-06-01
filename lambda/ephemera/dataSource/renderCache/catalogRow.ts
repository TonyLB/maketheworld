/**
 * DataSource-owned Dynamo CRUD for per-perspective catalog rows (`Cache::${perspectiveKey}`).
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import {
    buildCacheCatalogDataCategory,
    EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX,
    fetchCatalogRow,
    perspectiveKeyFromCatalogDataCategory,
    queryCatalogRowsForComponent as queryCatalogRowsFromGateway,
    type EphemeraCacheCatalogRow,
    type EphemeraCacheComponentId,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'
import internalCache from '../../internalCache'
import { shouldIncrementCatalogVersionOnInvalidation } from './catalogGuards'

export {
    buildCacheCatalogDataCategory,
    EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX,
    perspectiveKeyFromCatalogDataCategory,
} from '@tonylb/mtw-gateways/ts/ephemera/renderCache'

export async function queryCatalogRowsForComponent(
    componentId: EphemeraCacheComponentId
): Promise<EphemeraCacheCatalogRow[]> {
    return internalCache.RenderCache.getCatalogRows(componentId)
}

export async function getCatalogRow(
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<EphemeraCacheCatalogRow | undefined> {
    return internalCache.RenderCache.getCatalogRow(componentId, perspectiveKey)
}

/** Uncached fetch for tests and tooling only. */
export async function getCatalogRowFromDynamo(
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<EphemeraCacheCatalogRow | undefined> {
    return fetchCatalogRow(ephemeraDB, componentId, perspectiveKey)
}

/** Uncached query for tests and tooling only. */
export async function queryCatalogRowsFromDynamo(
    componentId: EphemeraCacheComponentId
): Promise<EphemeraCacheCatalogRow[]> {
    return queryCatalogRowsFromGateway(ephemeraDB, componentId)
}

export async function putCatalogRow(row: EphemeraCacheCatalogRow): Promise<void> {
    await ephemeraDB.putItem(row)
    internalCache.RenderCache.setCatalogRow({ row })
}

export type CreateCatalogRowForHydrateParams = {
    componentId: EphemeraCacheComponentId;
    perspectiveKey: string;
    assetStack: AssetUUID[];
};

/**
 * Create-on-first-hydrate catalog row (hydrate slice). Initial epoch >= 1, not yet hydrated.
 */
export async function createCatalogRowForHydrate(
    params: CreateCatalogRowForHydrateParams
): Promise<EphemeraCacheCatalogRow> {
    const row: EphemeraCacheCatalogRow = {
        EphemeraId: params.componentId,
        DataCategory: buildCacheCatalogDataCategory(params.perspectiveKey),
        assetStack: [...params.assetStack],
        catalogVersion: 1,
        hydratedCatalogVersion: 0,
    }
    await putCatalogRow(row)
    return row
}

/**
 * M4/V1 invalidation bump: increment catalogVersion only when ready; always clear currentCacheId.
 * No-op when the catalog row does not exist (V1).
 */
export async function conditionalInvalidateCatalogRow(row: EphemeraCacheCatalogRow): Promise<void> {
    const shouldBump = shouldIncrementCatalogVersionOnInvalidation(row)

    await ephemeraDB.optimisticUpdate({
        Key: { EphemeraId: row.EphemeraId, DataCategory: row.DataCategory },
        updateKeys: ['catalogVersion', 'hydratedCatalogVersion', 'currentCacheId'],
        updateReducer: (draft: EphemeraCacheCatalogRow) => {
            if (shouldBump) {
                draft.catalogVersion = row.catalogVersion + 1
            }
            delete draft.currentCacheId
        },
    })

    internalCache.RenderCache.invalidate(row.EphemeraId)
}

/**
 * H6: mark catalog ready at incomingCatalogVersion only if catalogVersion unchanged since hydrate start.
 * Returns true when hydratedCatalogVersion was written.
 */
export async function markCatalogHydratedAtVersion(
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string,
    incomingCatalogVersion: number
): Promise<boolean> {
    let wrote = false

    await ephemeraDB.optimisticUpdate({
        Key: {
            EphemeraId: componentId,
            DataCategory: buildCacheCatalogDataCategory(perspectiveKey),
        },
        updateKeys: ['hydratedCatalogVersion', 'catalogVersion'],
        checkKeys: ['catalogVersion'],
        updateReducer: (draft: EphemeraCacheCatalogRow) => {
            if (draft.catalogVersion === incomingCatalogVersion) {
                draft.hydratedCatalogVersion = incomingCatalogVersion
            }
        },
        successCallback: () => {
            wrote = true
            internalCache.RenderCache.invalidate(componentId)
        },
    })

    return wrote
}
