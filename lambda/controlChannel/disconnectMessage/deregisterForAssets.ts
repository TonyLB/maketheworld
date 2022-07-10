import { DisconnectMessage, MessageBus } from "../messageBus/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

export const discconnectForAssetsMessage = async ({ payloads, messageBus }: { payloads: DisconnectMessage[], messageBus: MessageBus }): Promise<void> => {

    await Promise.all([
        payloads.map(({ connectionId }) => {
            assetDB.deleteItem({
                AssetId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection'
            })
        }),
        assetDB.optimisticUpdate({
            key: {
                AssetId: 'Global',
                DataCategory: 'Connections'    
            },
            updateKeys: ['connections'],
            updateReducer: (draft: { connections?: Record<string, string> }) => {
                payloads.forEach((payload) => {
                    if (draft.connections === undefined) {
                        draft.connections = {}
                    }
                    delete draft.connections[payload.connectionId]
                })
            },
        })
    ])

}

export default discconnectForAssetsMessage
