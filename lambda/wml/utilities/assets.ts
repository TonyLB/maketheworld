import AssetWorkspace, { AssetWorkspaceAddress, isAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/ts/types"

//
// TODO: Strongly type AssetId as EphemeraCharacterId | EphemeraAssetId
//
export const assetWorkspaceFromAssetId = async (AssetId: string, scoped?: boolean): Promise<AssetWorkspace | undefined> => {
    const [type, scopedId] = splitType(AssetId)
    let dataCategory = 'Meta::Asset'
    switch(type) {
        case 'CHARACTER':
            dataCategory = 'Meta::Character'
            break
    }
    if (scoped) {
        const addresses = (await assetDB.query({
            IndexName: 'ScopedIdIndex',
            Key: { scopedId },
            ProjectionFields: ['address']
        }))
        if (addresses && addresses.length && isAssetWorkspaceAddress(addresses[0].address)) {
            return new AssetWorkspace(addresses[0].address)
        }
        return undefined
    }
    const { address } = (await assetDB.getItem<{ address: AssetWorkspaceAddress }>({
        Key: {
            AssetId,
            DataCategory: dataCategory
        },
        ProjectionFields: ['address']
    })) || {}
    if (!isAssetWorkspaceAddress(address)) {
        return undefined
    }
    return new AssetWorkspace(address)
}
