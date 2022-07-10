import { ConnectMessage, MessageBus } from "../messageBus/baseClasses"
import { assetDB } from "@tonylb/mtw-utilities/dist/dynamoDB"

import internalCache from '../internalCache'

export const connectForAssetsMessage = async ({ payloads, messageBus }: { payloads: ConnectMessage[], messageBus: MessageBus }): Promise<void> => {

    const connectionId = await internalCache.get({ category: 'Global', key: 'ConnectionId' })

    if (connectionId) {
        const aggregatePromises = payloads.reduce((previous, payload) => ([
            ...previous,
            assetDB.putItem({
                AssetId: `CONNECTION#${connectionId}`,
                DataCategory: 'Meta::Connection',
                player: payload.userName
            }),
        ]), [
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
                        if (payload.userName) {
                            draft.connections[connectionId] = payload.userName
                        }
                    })
                },
            })
        ] as Promise<any>[])
    
        await Promise.all(aggregatePromises)

    }

}

export default connectForAssetsMessage
