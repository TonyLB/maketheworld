import ReadOnlyAssetWorkspace, { AssetWorkspaceAddress, isAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/readOnly"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

//
// TODO: Strongly type AssetId as EphemeraCharacterId | EphemeraAssetId
//
export const assetWorkspaceFromAssetId = async (AssetId: string, scoped?: boolean): Promise<ReadOnlyAssetWorkspace | undefined> => {
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
            return new ReadOnlyAssetWorkspace(addresses[0].address)
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
    return new ReadOnlyAssetWorkspace(address)
}
