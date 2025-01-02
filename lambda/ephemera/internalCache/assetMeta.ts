import { EphemeraAssetId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

export type AssetMetaItem = {
    EphemeraId: EphemeraAssetId;
    found: boolean;
}

export class CacheAssetMetaData {
    AssetMetaById: Record<EphemeraAssetId, AssetMetaItem> = {};
    clear() {
        this.AssetMetaById = {}
    }
    async get(assetId: EphemeraAssetId): Promise<Omit<AssetMetaItem, 'found'> | undefined> {
        if (!(this.AssetMetaById[assetId])) {
            const assetData = await ephemeraDB.getItem<AssetMetaItem>({
                    Key: {
                        EphemeraId: assetId,
                        DataCategory: 'Meta::Asset'
                    },
                    ProjectionFields: ['EphemeraId'],
                })
            if (assetData) {
                this.AssetMetaById[assetId] = {
                    ...assetData,
                    found: true
                }
            }
            else {
                this.AssetMetaById[assetId] = {
                    EphemeraId: assetId,
                    found: false
                }
            }
        }
        if (this.AssetMetaById[assetId]?.found) {
            const { found, ...rest } = this.AssetMetaById[assetId]
            return rest
        }
        else {
            return undefined
        }
    }
    set(assetItem: Omit<AssetMetaItem, 'found'>): void {
        this.AssetMetaById[assetItem.EphemeraId] = {
            ...assetItem,
            found: true
        }
    }
}

export default CacheAssetMetaData
