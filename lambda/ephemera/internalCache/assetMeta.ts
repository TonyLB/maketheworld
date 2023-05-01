import { EphemeraAssetId, EphemeraCharacterId, EphemeraRoomId, LegalCharacterColor } from '@tonylb/mtw-interfaces/dist/baseClasses';
import { ephemeraDB } from '@tonylb/mtw-utilities/dist/dynamoDB'
import { NormalCharacterPronouns } from '@tonylb/mtw-wml/dist/normalize/baseClasses'
import { CacheConstructor } from './baseClasses'

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
                    EphemeraId: assetId,
                    DataCategory: 'Meta::Asset',
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
