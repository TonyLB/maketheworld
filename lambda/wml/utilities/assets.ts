import AssetWorkspace, { AssetWorkspaceAddress, isAssetWorkspaceAddress } from "@tonylb/mtw-asset-workspace/ts/"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { splitType } from "@tonylb/mtw-utilities/ts/types"

//
// Phase 1B: Thin wrapper around AssetWorkspace.fromUUID for backward compatibility
// TODO: Remove this function and replace direct calls with fromUUID in Phase 2
// TODO: Strongly type AssetId as EphemeraCharacterId | EphemeraAssetId
//
export const assetWorkspaceFromAssetId = async (AssetId: string, scoped?: boolean): Promise<AssetWorkspace | undefined> => {
    if (scoped) {
        // Scoped lookup still requires address-based query
        const [type, scopedId] = splitType(AssetId)
        let dataCategory = 'Meta::Asset'
        switch(type) {
            case 'CHARACTER':
                dataCategory = 'Meta::Character'
                break
        }
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
    
    return await AssetWorkspace.fromUUID(AssetId)
}
