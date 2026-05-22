/**
 * Fast cache pointers per perspective (M2): canonical on `Cache::` catalog rows; legacy Meta fallback.
 */
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheId, EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'
import type { EphemeraCacheComponentId } from './baseClasses'
import { getCatalogRow, perspectiveKeyFromCatalogDataCategory, queryCatalogRowsForComponent } from './catalogRow'

export async function resolvePerspectivePointer(
    hostId: EphemeraCacheComponentId,
    perspectiveKey: string,
    metaRoom?: EphemeraMetaRoom
): Promise<EphemeraCacheId | undefined> {
    const catalogRow = await getCatalogRow(hostId, perspectiveKey)
    if (catalogRow?.currentCacheId !== undefined) {
        return catalogRow.currentCacheId
    }
    if (metaRoom?.currentCacheByPerspective) {
        const legacy = metaRoom.currentCacheByPerspective[perspectiveKey]
        if (typeof legacy === 'string' && legacy.startsWith('CACHE#')) {
            return legacy as EphemeraCacheId
        }
    }
    return undefined
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

    if (hostId.startsWith('ROOM#')) {
        await ephemeraDB.optimisticUpdate({
            Key: { EphemeraId: hostId as EphemeraRoomId, DataCategory: 'Meta::Room' },
            updateKeys: ['currentCacheByPerspective'],
            updateReducer: (draft: EphemeraMetaRoom) => {
                if (draft.currentCacheByPerspective && typeof draft.currentCacheByPerspective === 'object') {
                    delete draft.currentCacheByPerspective[perspectiveKey]
                }
            },
        })
        internalCache.ComponentEphemeraMeta.invalidate(hostId as EphemeraRoomId)
        internalCache.ComponentStackMerge.invalidate(hostId as EphemeraRoomId)
    }
}

export type PerspectivePointerEntry = {
    perspectiveKey: string;
    cacheId: EphemeraCacheId;
};

/**
 * Union of catalog `currentCacheId` pointers and legacy Meta map entries (catalog wins per key).
 */
export async function collectPerspectivePointerEntries(
    roomId: EphemeraRoomId,
    metaRoom?: EphemeraMetaRoom
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

    const legacyMap = metaRoom?.currentCacheByPerspective ?? {}
    for (const [perspectiveKey, cacheId] of Object.entries(legacyMap)) {
        if (!byKey.has(perspectiveKey) && typeof cacheId === 'string' && cacheId.startsWith('CACHE#')) {
            byKey.set(perspectiveKey, cacheId as EphemeraCacheId)
        }
    }

    return [...byKey.entries()].map(([perspectiveKey, cacheId]) => ({ perspectiveKey, cacheId }))
}
