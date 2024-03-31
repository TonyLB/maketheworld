import { isAssetWorkspaceAddress, AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

type MetaCache = {
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    address?: AssetWorkspaceAddress;
}

export const handler = async (event) => {

    const { assetIds, player, tag } = event

    const addressfetches = (await assetDB.getItems<MetaCache>({
        Keys: assetIds.map((AssetId) => ({
            AssetId,
            DataCategory: 'Meta::Asset'
        })),
        ProjectionFields: ['AssetId', 'address']
    })) || []
    const returnValue = addressfetches.filter((value): value is Omit<MetaCache, 'address'> & { address: AssetWorkspaceAddress } => (isAssetWorkspaceAddress(value.address)))

    if (returnValue.length) {
        return returnValue
    }
    else {
        if (!(player && tag)) {
            throw new Error('Player or tag unspecified when asset needs to be created')
        }
        return assetIds.map((assetId): Omit<MetaCache, 'address'> & { address: AssetWorkspaceAddress } => ({
            AssetId: assetId,
            address: {
                zone: 'Personal',
                player,
                fileName: assetId.split('#').slice(1)[0],
                subFolder: `${tag}s`
            }
        }))
    }

}
