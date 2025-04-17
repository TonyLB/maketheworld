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
                assetDB.deleteItem(componentKey)
            ))
        )
    }))
}

export default decacheAssetMessage