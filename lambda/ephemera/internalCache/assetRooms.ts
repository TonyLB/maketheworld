import { EphemeraAssetId, EphemeraRoomId } from '@tonylb/mtw-interfaces/dist/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { CacheConstructor } from './baseClasses'

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
            const assetRooms = await ephemeraDB.query<{ EphemeraId: EphemeraRoomId, DataCategory: string }>({
                IndexName: 'DataCategoryIndex',
                Key: { DataCategory: assetId },
                KeyConditionExpression: 'begins_with(EphemeraId, :roomPrefix)',
                ExpressionAttributeValues: {
                    ':roomPrefix': 'ROOM#'
                },        
            })
            if (assetRooms) {
                this.AssetRoomsById[assetId] = {
                    EphemeraId: assetId,
                    rooms: assetRooms.map(({ EphemeraId }) => (EphemeraId)),
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

export const CacheAssetRooms = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheAssetRooms extends Base {
        AssetRooms: CacheAssetRoomsData = new CacheAssetRoomsData()

        override clear() {
            this.AssetRooms.clear()
            super.clear()
        }
    }
}

export default CacheAssetRooms
