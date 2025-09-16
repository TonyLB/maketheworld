import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { isEphemeraId } from "@tonylb/mtw-interfaces/ts/baseClasses"

/**
 * Remove asset content from DynamoDB storage
 * 
 * This function removes all component data associated with an asset from the database,
 * including updating component metadata to remove the asset from cached lists.
 * 
 * @param params - Parameters object
 * @param params.assetId - The asset ID to remove from cache
 * @param params.streamEvent - Function to stream events to EventBridge and messageBus subscribers
 * @returns Promise<void>
 */
export const decacheAsset = async ({ assetId, streamEvent }: {
    assetId: string;
    streamEvent: (params: {
        update: any;
        streamKey: string;
        detailType: string;
    }) => Promise<void>;
}): Promise<void> => {
    const componentIds = await assetDB.query<{ AssetId: string; DataCategory: string }>({
        Key: { DataCategory: `ASSET#${assetId}` },
        IndexName: "DataCategoryIndex"
    })
    
    const componentsToRemove = componentIds.filter(({ AssetId }) => (isEphemeraId(AssetId)))
    
    // Database operations first
    await Promise.all(componentsToRemove.map(async (componentKey) => (
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
    )))
    
    // Component Removed streaming events
    await Promise.all(componentsToRemove.map(({ AssetId: componentId }) => (
        streamEvent({
            update: {
                type: 'Component Removed',
                assetId,
                componentId
            },
            streamKey: assetId,
            detailType: 'Component Removed'
        })
    )))
}
