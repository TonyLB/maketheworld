import type { MessageBus } from '../../../messageBus/baseClasses'

import type {
    ConversationHandleGenerateRoomPreview,
    StorableConversationRecordGenerateRoomPreview,
} from './baseClasses'

import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'

export type MaterializeGenerateRoomPreviewDeps = {
    messageBus: MessageBus
    /** Process-local WebSocket connection id for `apiClient.send` (was read from `internalCache.Global` before deps refactor). */
    getConnectionId: () => Promise<string | undefined>
}

export function materializeGenerateRoomPreview(
    record: StorableConversationRecordGenerateRoomPreview,
    deps: MaterializeGenerateRoomPreviewDeps
): ConversationHandleGenerateRoomPreview {
    // MVP: `sendMessage` emits ConversationStep frames directly. Terminal steps no longer enqueue `ReturnValue`.
    void deps.messageBus

    const sendMessage: ConversationHandleGenerateRoomPreview['sendMessage'] = async (arg) => {
        const ConnectionId = await deps.getConnectionId()

        if (arg === 'generating') {
            const step = {
                messageType: 'ConversationStep' as const,
                conversationId: record.conversationId,
                pipeline: 'generateRoomPreview' as const,
                step: 'generating' as const,
                ...(record.routing.requestId !== undefined ? { RequestId: record.routing.requestId } : {}),
            }

            await apiClient.send({
                ConnectionId,
                Data: JSON.stringify(step),
            })
            return
        }

        const step = {
            messageType: 'ConversationStep' as const,
            conversationId: record.conversationId,
            pipeline: 'generateRoomPreview' as const,
            step: arg.success ? 'complete' : 'error',
            generateRoomPreview: arg,
            ...(record.routing.requestId !== undefined ? { RequestId: record.routing.requestId } : {}),
        }

        await apiClient.send({
            ConnectionId,
            Data: JSON.stringify(step),
        })
    }

    return {
        ...record,
        sendMessage,
    }
}
