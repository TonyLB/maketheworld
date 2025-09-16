import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { isEphemeraId } from "@tonylb/mtw-interfaces/ts/baseClasses"

/**
 * Remove asset content from DynamoDB storage
 * 
 * This function removes all component data associated with an asset from the database,
 * including updating component metadata to remove the asset from cached lists.
 * 
 * @param assetId - The asset ID to remove from cache
 * @returns Promise<void>
 */
export const decacheAsset = async (assetId: string): Promise<void> => {
    const componentIds = await assetDB.query<{ AssetId: string; DataCategory: string }>({
        Key: { DataCategory: `ASSET#${assetId}` },
        IndexName: "DataCategoryIndex"
    })
    
    await Promise.all(componentIds
        .filter(({ AssetId }) => (isEphemeraId(AssetId)))
        .map(async (componentKey) => (
            Promise.all([
                assetDB.deleteItem(componentKey),
                assetDB.optimisticUpdate({
                    Key: {
                        AssetId: componentKey.AssetId,
                        DataCategory: `Meta::${componentKey.AssetId[0]}${componentKey.AssetId.slice(1).split('#')[0].toLocaleLowerCase()}`,
                    },
                    updateKeys: ['cached'],
                    updateReducer: (draft) => {
                        if (!('cached' in draft)) {
                            draft.cached = []
                        }
                        draft.cached = draft.cached.filter((id) => (id !== assetId))
                    },
                    deleteCondition: (draft) => (draft.cached.length === 0)
                })
            ])
        ))
    )
}
