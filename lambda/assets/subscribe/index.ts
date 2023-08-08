import { legacyConnectionDB as connectionDB, exponentialBackoffWrapper, multiTableTransactWrite } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { LibrarySubscribeMessage, LibraryUnsubscribeMessage, MessageBus } from "../messageBus/baseClasses"
import internalCache from "../internalCache"
import { unique } from "@tonylb/mtw-utilities/dist/lists"
import { asyncSuppressExceptions } from "@tonylb/mtw-utilities/dist/errors"
import { marshall } from "@aws-sdk/util-dynamodb"

export const librarySubscribeMessage = async ({ payloads, messageBus }: { payloads: LibrarySubscribeMessage[], messageBus: MessageBus }): Promise<void> => {
    const connectionId = await internalCache.Connection.get('connectionId')
    let subscriptionSuccess = false
    await asyncSuppressExceptions(async () => {
        await exponentialBackoffWrapper(async () => {

            const checkSubscriptions = await internalCache.Connection.get('librarySubscriptions')
            const newConnections = unique(checkSubscriptions || [], [connectionId]) as string[]
            if (newConnections.length) {
                await multiTableTransactWrite([
                    {
                        Update: {
                            TableName: 'Connections',
                            Key: marshall({
                                ConnectionId: 'Library',
                                DataCategory: 'Subscriptions'
                            }),
                            UpdateExpression: 'SET ConnectionIds = :newConnections',
                            ExpressionAttributeValues: marshall({
                                ':newConnections': newConnections,
                                ...((typeof checkSubscriptions === 'undefined')
                                    ? {}
                                    : { ':oldConnections': checkSubscriptions }
                                )
                            }),
                            ConditionExpression: (typeof checkSubscriptions === 'undefined')
                                ? 'attribute_not_exists(ConnectionIds)'
                                : 'ConnectionIds = :oldConnections'
                        }
                    },
                    {
                        ConditionCheck: {
                            TableName: 'Connections',
                            Key: marshall({
                                ConnectionId: `CONNECTION#${connectionId}`,
                                DataCategory: 'Meta::Connection'
                            }),
                            ConditionExpression: 'attribute_exists(DataCategory)'
                        }
                    }
                ])
                subscriptionSuccess = true    
            }
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
