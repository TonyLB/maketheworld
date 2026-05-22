/**
 * DataSource-owned Dynamo CRUD for per-perspective catalog rows (`Cache::${perspectiveKey}`).
 */
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import {
    buildCacheCatalogDataCategory,
    EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX,
    isEphemeraCacheCatalogRow,
    type EphemeraCacheCatalogRow,
    type EphemeraCacheComponentId,
} from './baseClasses'
import { shouldIncrementCatalogVersionOnInvalidation } from './catalogGuards'

export async function queryCatalogRowsForComponent(
    componentId: EphemeraCacheComponentId
): Promise<EphemeraCacheCatalogRow[]> {
    const raw = await ephemeraDB.query<EphemeraCacheCatalogRow>({
        Key: { EphemeraId: componentId },
        KeyConditionExpression: 'begins_with(DataCategory, :dcPrefix)',
        ExpressionAttributeValues: { ':dcPrefix': EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX },
        allFields: true,
    })
    return raw.filter(isEphemeraCacheCatalogRow)
}

export async function getCatalogRow(
    componentId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<EphemeraCacheCatalogRow | undefined> {
    const item = await ephemeraDB.getItem<EphemeraCacheCatalogRow>({
        Key: {
            EphemeraId: componentId,
            DataCategory: buildCacheCatalogDataCategory(perspectiveKey),
        },
        getAllFields: true,
    })
    return item && isEphemeraCacheCatalogRow(item) ? item : undefined
}

export async function putCatalogRow(row: EphemeraCacheCatalogRow): Promise<void> {
    await ephemeraDB.putItem(row)
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

export const perspectiveKeyFromCatalogDataCategory = (dataCategory: string): string | undefined => {
    if (!dataCategory.startsWith(EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX)) {
        return undefined
    }
    const key = dataCategory.slice(EPHEMERA_CACHE_CATALOG_DATA_CATEGORY_PREFIX.length)
    return key.length > 0 ? key : undefined
}
