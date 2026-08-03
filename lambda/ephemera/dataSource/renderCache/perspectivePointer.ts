/**
 * Fast cache pointers per perspective: canonical (and only) storage is `currentCacheId` on `Cache::` catalog rows.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import type { EphemeraCacheComponentId } from './baseClasses'
import { getCatalogRow, perspectiveKeyFromCatalogDataCategory, queryCatalogRowsForComponent } from './catalogRow'

export async function resolvePerspectivePointer(
    hostId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<EphemeraCacheId | undefined> {
    const catalogRow = await getCatalogRow(hostId, perspectiveKey)
    return catalogRow?.currentCacheId
}

/**
 * Set the `currentCacheId` fast pointer on a perspective's catalog row. No-op when the catalog row
 * does not exist yet (mirrors `conditionalInvalidateCatalogRow`'s no-op convention). Touches only the
 * `Cache::` catalog row -- never a `CACHE#` row.
 */
export async function setPerspectivePointer(
    hostId: EphemeraCacheComponentId,
    perspectiveKey: string,
    cacheId: EphemeraCacheId
): Promise<void> {
    const catalogRow = await getCatalogRow(hostId, perspectiveKey)
    if (catalogRow) {
        await ephemeraDB.optimisticUpdate({
            Key: { EphemeraId: catalogRow.EphemeraId, DataCategory: catalogRow.DataCategory },
            updateKeys: ['currentCacheId'],
            updateReducer: (draft: { currentCacheId?: EphemeraCacheId }) => {
                draft.currentCacheId = cacheId
            },
        })
    }
}

export async function clearPerspectivePointer(
    hostId: EphemeraCacheComponentId,
    perspectiveKey: string
): Promise<void> {
    const catalogRow = await getCatalogRow(hostId, perspectiveKey)
    if (catalogRow) {
        await ephemeraDB.optimisticUpdate({
            Key: { EphemeraId: catalogRow.EphemeraId, DataCategory: catalogRow.DataCategory },
            updateKeys: ['currentCacheId'],
            updateReducer: (draft: { currentCacheId?: EphemeraCacheId }) => {
                delete draft.currentCacheId
            },
        })
    }
}

export type PerspectivePointerEntry = {
    perspectiveKey: string;
    cacheId: EphemeraCacheId;
};

/**
 * Catalog `currentCacheId` pointers for every perspective of a room.
 */
export async function collectPerspectivePointerEntries(
    roomId: EphemeraRoomId
): Promise<PerspectivePointerEntry[]> {
    const byKey = new Map<string, EphemeraCacheId>()

    const catalogRows = await queryCatalogRowsForComponent(roomId)
    for (const row of catalogRows) {
        if (row.currentCacheId === undefined) {
            continue
        }
        const perspectiveKey = perspectiveKeyFromCatalogDataCategory(row.DataCategory)
        if (perspectiveKey) {
            byKey.set(perspectiveKey, row.currentCacheId)
        }
    }

    return [...byKey.entries()].map(([perspectiveKey, cacheId]) => ({ perspectiveKey, cacheId }))
}
