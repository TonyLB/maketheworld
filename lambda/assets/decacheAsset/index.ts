import { DecacheAssetMessage, MessageBus } from "../messageBus/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { isEphemeraId } from "@tonylb/mtw-interfaces/ts/baseClasses"

export const decacheAssetMessage = async ({ payloads, messageBus }: { payloads: DecacheAssetMessage[], messageBus: MessageBus }): Promise<void> => {
    await Promise.all(payloads.map(async (payload) => {
        const { assetId } = payload
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
    }))
}

export default decacheAssetMessage