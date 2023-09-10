import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { CacheConstructor } from './baseClasses'
import { AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'

export type AssetAddressItem = {
    EphemeraId: EphemeraAssetId | EphemeraCharacterId;
    address: AssetWorkspaceAddress
}

export class CacheAssetAddressData {
    AssetAddressById: Record<EphemeraAssetId | EphemeraCharacterId, AssetAddressItem> = {};
    clear() {
        this.AssetAddressById = {}
    }
    async get(assetId: EphemeraAssetId | EphemeraCharacterId): Promise<AssetAddressItem | undefined> {
        return this.AssetAddressById[assetId]
    }
    set(assetItem: AssetAddressItem): void {
        this.AssetAddressById[assetItem.EphemeraId] = assetItem
    }
}

export const CacheAssetAddress = <GBase extends CacheConstructor>(Base: GBase) => {
    return class CacheAssetAddress extends Base {
        AssetAddress: CacheAssetAddressData = new CacheAssetAddressData()

        override clear() {
            this.AssetAddress.clear()
            super.clear()
        }
    }
}

export default CacheAssetAddress
