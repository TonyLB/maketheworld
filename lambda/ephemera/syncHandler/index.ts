import { SyncRequest, SyncResponse, MessageBus } from "../messageBus/baseClasses"
import { messageDeltaQuery } from "@tonylb/mtw-utilities/dist/dynamoDB"
import { apiClient } from "@tonylb/mtw-utilities/dist/apiManagement/apiManagementClient"
import internalCache from "../internalCache"

export const syncRequest = async ({ payloads, messageBus }: { payloads: SyncRequest[], messageBus: MessageBus }): Promise<void> => {

    const handleOneRequest = async ({ payload, messageBus }: { payload: SyncRequest, messageBus: MessageBus }): Promise<void> => {
        const epochTime = Date.now()
        const { Items, LastEvaluatedKey} = await messageDeltaQuery({
            Target: payload.targetId,
            StartingAt: payload.startingAt,
            Limit: payload.limit || 50,
            ExclusiveStartKey: payload.LastEvaluatedKey
        })
        if (LastEvaluatedKey && (payload.loopCount || 0) < 40) {
            messageBus?.send({
                type: 'Sync',
                targetId: payload.targetId,
                startingAt: payload.startingAt,
                LastEvaluatedKey,
                limit: payload.limit,
                loopCount: (payload.loopCount || 0) + 1
            })    
            messageBus.send({
                type: 'SyncResponse',
                messages: Items
                    .map(({ Target, DeltaId, RowId, ...rest }) => ({ Target: payload.targetId, MessageId: RowId, ...rest })),
            })
        }
        else {
            messageBus.send({
                type: 'SyncResponse',
                messages: Items
                    .map(({ Target, DeltaId, RowId, ...rest }) => ({ Target: payload.targetId, MessageId: RowId, ...rest })),
                lastSync: epochTime
            })
        }
    }

    if (messageBus) {
        await Promise.all(payloads.map((payload) => (handleOneRequest({ payload, messageBus }))))
    }

}

export const syncResponse = async ({ payloads }: { payloads: SyncResponse[], messageBus?: MessageBus }): Promise<void> => {
    const [ConnectionId, RequestId] = await Promise.all([
        internalCache.Global.get('ConnectionId'),
        internalCache.Global.get('RequestId')
    ])
    if (ConnectionId) {
        await Promise.all(payloads.map(async (payload) => {
            if (payload.lastSync) {
                await apiClient.send({
                    ConnectionId,
                    Data: JSON.stringify({
                        messageType: 'Messages',
                        messages: payload.messages,
                        LastSync: payload.lastSync,
                        RequestId
                    })
                })
            }
            else {
                await apiClient.send({
                    ConnectionId,
                    Data: JSON.stringify({
                        messageType: 'Messages',
                        messages: payload.messages
                    })
                })    
            }
        }))
    }
}

