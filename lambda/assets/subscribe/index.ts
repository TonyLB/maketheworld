import { legacyConnectionDB as connectionDB, connectionDB as newConnectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { LibrarySubscribeMessage, LibraryUnsubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"

export const librarySubscribeMessage = async ({ payloads, messageBus }: { payloads: LibrarySubscribeMessage[], messageBus: MessageBus }): Promise<void> => {
    const connectionId = await internalCache.Connection.get('connectionId')
    let subscriptionSuccess = false
    await asyncSuppressExceptions(async () => {
        await exponentialBackoffWrapper(async () => {
            await newConnectionDB.transactWrite([
                {
                    Update: {
                        Key: {
                            ConnectionId: 'Library',
                            DataCategory: 'Subscriptions'
                        },
                        updateKeys: ['ConnectionIds'],
                        updateReducer: (draft) => {
                            draft.ConnectionIds = unique(draft.ConnectionIds || [], [connectionId]) as string[]
                        }
                    }
                },
                {
                    ConditionCheck: {
                        Key: {
                            ConnectionId: `CONNECTION#${connectionId}`,
                            DataCategory: 'Meta::Connection'
                        },
                        ConditionExpression: 'attribute_exists(DataCategory)',
                        ProjectionFields: ['DataCategory']
                    }
                }
            ])
            subscriptionSuccess = true    
        }, {
            retryErrors: ['TransactionCanceledException'],
            retryCallback: async () => {
                internalCache.Connection.invalidate('librarySubscriptions')
            }
        })

        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Success' }
        })    
    })
    if (!subscriptionSuccess) {
        messageBus.send({
            type: 'ReturnValue',
            body: { messageType: 'Error' }
        })
    }
}

export const libraryUnsubscribeMessage = async ({ payloads, messageBus }: { payloads: LibraryUnsubscribeMessage[], messageBus: MessageBus }): Promise<void> => {
    const connectionId = await internalCache.Connection.get('connectionId')

    await connectionDB.optimisticUpdate({
        key: {
            ConnectionId: 'Library',
            DataCategory: 'Subscriptions'
        },
        updateKeys: ['ConnectionIds'],
        updateReducer: (draft) => {
            draft.ConnectionIds = (draft.ConnectionIds || []).filter((value) => (value !== connectionId))
        },
    })

    messageBus.send({
        type: 'ReturnValue',
        body: { messageType: 'Success' }
    })    
}
