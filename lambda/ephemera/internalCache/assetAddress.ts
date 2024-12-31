import { EphemeraAssetId, EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
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

export default CacheAssetAddressData
