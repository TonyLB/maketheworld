import AssetWorkspace, { AssetWorkspaceAddress, isAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/dist/"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/dist/types"

export const assetWorkspaceFromAssetId = async (AssetId: string): Promise<AssetWorkspace | undefined> => {
    const [type] = splitType(AssetId)
    let dataCategory = 'Meta::Asset'
    switch(type) {
        case 'CHARACTER':
            dataCategory = 'Meta::Character'
            break
    }
    const address = (await assetDB.getItem<AssetWorkspaceAddress>({
        AssetId,
        DataCategory: dataCategory,
        ProjectionFields: ['fileName', '#zone', 'player', 'subFolder'],
        ExpressionAttributeNames: {
            '#zone': 'zone'
        }
    })) || {}
    if (!isAssetWorkspaceAddress(address)) {
        return undefined
    }
    return new AssetWorkspace(address)
}
