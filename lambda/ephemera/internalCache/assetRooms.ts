import { EphemeraAssetId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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

export class CacheRoomAssetsData {
    RoomAssetsById: Record<EphemeraRoomId, { EphemeraId: EphemeraRoomId, cached: EphemeraAssetId[] }> = {};
    clear() {
        this.RoomAssetsById = {}
    }
    async get(roomId: EphemeraRoomId): Promise<EphemeraAssetId[] | undefined> {
        if (!(this.RoomAssetsById[roomId])) {
            const roomAssets = await assetDB.getItem<{ cached?: string[] }>({
                Key: { AssetId: roomId, DataCategory: 'Meta::Room' },
                ProjectionFields: ['cached']
            })
            if (roomAssets) {
                this.RoomAssetsById[roomId] = {
                    EphemeraId: roomId,
                    cached: (roomAssets.cached || []).map(AssetKey)
                }
            }
            else {
                this.RoomAssetsById[roomId] = {
                    EphemeraId: roomId,
                    cached: []
                }
            }
        }
        return this.RoomAssetsById[roomId]?.cached || []
    }

}
