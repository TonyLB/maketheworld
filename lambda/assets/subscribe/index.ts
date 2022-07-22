import { connectionDB } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { LibrarySubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"

export const librarySubscribeMessage = async ({ payloads, messageBus }: { payloads: LibrarySubscribeMessage[], messageBus: MessageBus }): Promise<void> => {
    const connectionId = await internalCache.Connection.get('connectionId')
    await asyncSuppressExceptions(async () => {
        await connectionDB.optimisticUpdate({
            key: {
                ConnectionId: 'Library',
                DataCategory: 'Subscriptions'
            },
            updateKeys: ['ConnectionIds'],
            updateReducer: (draft) => {
                if (draft.ConnectionIds === undefined) {
                    draft.ConnectionIds = []
                }
                if (connectionId) {
                    draft.ConnectionIds = unique(draft.ConnectionIds, [connectionId])
                }
            },
        })
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Success' }
        })    
    }, async () => {
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Error' }
        })
    })
}
