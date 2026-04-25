import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AssetUUID } from '@tonylb/mtw-base/ts/schema'
import type { InternalCache } from '../../internalCache'

export type CanonAssetStackCache = Pick<InternalCache, 'RoomAssets' | 'AssetMetaData'>

export type RoomAssetStackCache = Pick<InternalCache, 'RoomAssets'>

/**
 * Resolve full room stack from `Meta::Room.cached` participation order.
 * Includes Canon and non-Canon assets; order matches `cached`.
 */
export async function resolveRoomAssetStackForRoom(
    roomId: EphemeraRoomId,
    cache: RoomAssetStackCache
): Promise<AssetUUID[]> {
    const ids = (await cache.RoomAssets.get(roomId)) ?? []
    return ids
}

/**
 * Resolve `perspective.assetStack` for room state defaults: participation order from `Meta::Room.cached`
 * ([`RoomAssets.get`](../../internalCache/assetRooms.ts)), then keep only assets whose `Meta::Asset` row has
 * `zone === 'Canon'`. Order among Canon assets matches `cached` order.
 *
 * Used by `computeDefaultMarksForRoom` when `Meta::Room` has no usable stored marks.
 */
export async function resolveCanonAssetStackForRoom(
    roomId: EphemeraRoomId,
    cache: CanonAssetStackCache
): Promise<AssetUUID[]> {
    const ids = (await cache.RoomAssets.get(roomId)) ?? []
    if (ids.length === 0) {
        return []
    }
    const metas = await cache.AssetMetaData.get(ids)
    return metas
        .filter((meta) => meta.zone === 'Canon')
        .map((meta) => meta.AssetId)
}
