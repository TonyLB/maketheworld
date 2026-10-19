import { EphemeraAssetId, EphemeraAreaId, EphemeraFeatureId, EphemeraRoomId, isEphemeraAreaId, isEphemeraFeatureId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { AssetKey } from '@tonylb/mtw-utilities/ts/types';

export type AssetRoomsItem = {
    EphemeraId: EphemeraAssetId;
    rooms: EphemeraRoomId[];
    found: boolean;
}

export class CacheAssetRoomsData {
    AssetRoomsById: Record<EphemeraAssetId, AssetRoomsItem> = {};
    clear() {
        this.AssetRoomsById = {}
    }
    async get(assetId: EphemeraAssetId): Promise<Omit<AssetRoomsItem, 'found'> | undefined> {
        if (!(this.AssetRoomsById[assetId])) {
            const assetRooms = await assetDB.query<{ AssetId: EphemeraRoomId, DataCategory: string }>({
                IndexName: 'DataCategoryIndex',
                Key: { DataCategory: assetId },
                KeyConditionExpression: 'begins_with(AssetId, :roomPrefix)',
                ExpressionAttributeValues: {
                    ':roomPrefix': 'ROOM#'
                },        
            })
            if (assetRooms) {
                this.AssetRoomsById[assetId] = {
                    EphemeraId: assetId,
                    rooms: assetRooms.map(({ AssetId }) => (AssetId)),
                    found: true
                }
            }
            else {
                this.AssetRoomsById[assetId] = {
                    EphemeraId: assetId,
                    rooms: [],
                    found: false
                }
            }
        }
        if (this.AssetRoomsById[assetId]?.found) {
            const { found, ...rest } = this.AssetRoomsById[assetId]
            return rest
        }
        else {
            return undefined
        }
    }
    set(assetItem: Omit<AssetRoomsItem, 'found'>): void {
        this.AssetRoomsById[assetItem.EphemeraId] = {
            ...assetItem,
            found: true
        }
    }
}

/** The membership hosts whose participating assets are listed (a Character's cache lists none). */
export type AssetHostId = EphemeraRoomId | EphemeraAreaId | EphemeraFeatureId

/** The `Meta::<Tag>` row that lists the assets whose cache holds a membership host. */
const metaCategoryOf = (hostId: AssetHostId): string => (
    isEphemeraAreaId(hostId) ? 'Meta::Area' : isEphemeraFeatureId(hostId) ? 'Meta::Feature' : 'Meta::Room'
)

/**
 * The assets that participate in a membership host (Room, Area or Feature): `Meta::<Tag>.cached`.
 * Named for its original Room-only use, which is still its main one.
 */
export class CacheRoomAssetsData {
    RoomAssetsById: Record<string, { EphemeraId: AssetHostId, cached: EphemeraAssetId[] }> = {};
    clear() {
        this.RoomAssetsById = {}
    }
    async get(hostId: AssetHostId): Promise<EphemeraAssetId[] | undefined> {
        if (!(this.RoomAssetsById[hostId])) {
            const hostAssets = await assetDB.getItem<{ cached?: string[] }>({
                Key: { AssetId: hostId, DataCategory: metaCategoryOf(hostId) },
                ProjectionFields: ['cached']
            })
            this.RoomAssetsById[hostId] = {
                EphemeraId: hostId,
                cached: (hostAssets?.cached || []).map(AssetKey)
            }
        }
        return this.RoomAssetsById[hostId]?.cached || []
    }

}
