import { isAssetWorkspaceAddress, AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

type MetaCache = {
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    address?: AssetWorkspaceAddress;
}

export const handler = async (event) => {

    const { assetIds } = event

    const addressfetches = (await assetDB.getItems<MetaCache>({
        Keys: assetIds.map((AssetId) => ({
            AssetId,
            DataCategory: 'Meta::Asset'
        })),
        ProjectionFields: ['AssetId', 'address']
    })) || []
    return addressfetches.filter((value): value is Omit<MetaCache, 'address'> & { address: AssetWorkspaceAddress } => (isAssetWorkspaceAddress(value.address)))

}
