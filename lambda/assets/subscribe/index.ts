import { connectionDB, exponentialBackoffWrapper } from "@tonylb/mtw-utilities/ts/dynamoDB"
import { LibrarySubscribeMessage, LibraryUnsubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/ts/lists"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/ts/errors"

export const librarySubscribeMessage = async ({ payloads, messageBus }: { payloads: LibrarySubscribeMessage[], messageBus: MessageBus }): Promise<void> => {
    const sessionId = await internalCache.Connection.get('sessionId')
    let subscriptionSuccess = false
    await asyncSuppressExceptions(async () => {
        await exponentialBackoffWrapper(async () => {
            await connectionDB.transactWrite([
                {
                    Update: {
                        Key: {
                            ConnectionId: 'Library',
                            DataCategory: 'Subscriptions'
                        },
                        updateKeys: ['SessionIds'],
                        updateReducer: (draft) => {
                            draft.SessionIds = unique(draft.SessionIds || [], [sessionId]) as string[]
                        }
                    }
                },
                {
                    ConditionCheck: {
                        Key: {
                            ConnectionId: `SESSION#${sessionId}`,
                            DataCategory: 'Meta::Session'
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
    const sessionId = await internalCache.Connection.get('sessionId')

    await connectionDB.optimisticUpdate({
        Key: {
            ConnectionId: 'Library',
            DataCategory: 'Subscriptions'
        },
        updateKeys: ['SessionIds'],
        updateReducer: (draft) => {
            draft.SessionIds = (draft.SessionIds || []).filter((value) => (value !== sessionId))
        },
    })

    messageBus.send({
        type: 'ReturnValue',
        body: { messageType: 'Success' }
    })    
}
