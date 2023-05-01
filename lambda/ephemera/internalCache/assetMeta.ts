import { EphemeraAssetId, EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { NormalCharacterPronouns } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { CacheConstructor } from './baseClasses'

export type AssetMetaItem = {
    EphemeraId: EphemeraAssetId;
}

export class CacheAssetMetaData {
    AssetMetaById: Record<EphemeraAssetId, AssetMetaItem> = {};
    clear() {
        this.AssetMetaById = {}
    }
    async get(assetId: EphemeraAssetId): Promise<AssetMetaItem | undefined> {
        if (!(this.AssetMetaById[assetId])) {
            const assetData = await ephemeraDB.getItem<AssetMetaItem>({
                    EphemeraId: assetId,
                    DataCategory: 'Meta::Asset',
                    ProjectionFields: ['EphemeraId'],
                })
            if (assetData) {
                this.AssetMetaById[assetId] = assetData
            }
        }
        return this.AssetMetaById[assetId]
    }
    set(assetItem: AssetMetaItem): void {
        this.AssetMetaById[assetItem.EphemeraId] = assetItem
    }
}

export const CacheAssetMeta = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheAssetMeta extends Base {
        AssetMeta: CacheAssetMetaData = new CacheAssetMetaData()

        override clear() {
            this.AssetMeta.clear()
            super.clear()
        }
    }
}

export default CacheAssetMeta
