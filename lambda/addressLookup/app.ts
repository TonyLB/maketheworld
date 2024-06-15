import { isAssetWorkspaceAddress, AssetWorkspaceAddress } from '@tonylb/mtw-asset-workspace/ts/readOnly'
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

type MetaCache = {
    AssetId: `ASSET#${string}` | `CHARACTER#${string}`;
    address?: AssetWorkspaceAddress;
}

export const handler = async (event) => {

    const { assetIds, player, tag, create } = event

    const isDraftAssetId = (assetId: string): assetId is `ASSET#draft[${string}]` => (
        assetId.startsWith('ASSET#draft[') && assetId.endsWith(']')
    )
    const draftAssetIds = (assetIds as string[]).filter(isDraftAssetId)
    const nonDraftAssetIds = (assetIds as string[]).filter((assetId) => (!isDraftAssetId))

    const addressfetches = (await assetDB.getItems<MetaCache>({
        Keys: nonDraftAssetIds.map((AssetId) => ({
            AssetId,
            DataCategory: `Meta::${tag}`
        })),
        ProjectionFields: ['AssetId', 'address']
    })) || []
    const returnValue = [
        ...draftAssetIds.map((assetId): Omit<MetaCache, 'address'> & { address: AssetWorkspaceAddress } => {
            const player = assetId.split('[').slice(1)[0].slice(0, -1)
            return {
                AssetId: assetId,
                address: {
                    zone: 'Draft',
                    player
                }
            }
        }),
        ...addressfetches.filter((value): value is Omit<MetaCache, 'address'> & { address: AssetWorkspaceAddress } => (isAssetWorkspaceAddress(value.address)))
    ]

    if (returnValue.length) {
        return returnValue
    }
    else if (create) {
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
