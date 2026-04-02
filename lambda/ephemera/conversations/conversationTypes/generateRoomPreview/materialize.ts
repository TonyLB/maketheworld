import type { MessageBus } from '../../../messageBus/baseClasses'

import type {
    ConversationHandleGenerateRoomPreview,
    StorableConversationRecordGenerateRoomPreview,
} from './baseClasses'
import type { RenderResolveOutput } from '../../../dataSource/renderOrchestration/baseClasses'

import { apiClient } from '@tonylb/mtw-utilities/ts/apiManagement/apiManagementClient'
import { renderResolveOutputToGenerateRoomPreviewResult } from './renderResolveOutputToGenerateRoomPreviewResult'

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

        if (arg === 'resolving') {
            return
        }

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

        const enrichedOutput = enrichRenderResolveForPreview(arg)
        const generateRoomPreview = renderResolveOutputToGenerateRoomPreviewResult(enrichedOutput)

        const step = {
            messageType: 'ConversationStep' as const,
            conversationId: record.conversationId,
            pipeline: 'generateRoomPreview' as const,
            step: generateRoomPreview.success ? ('complete' as const) : ('error' as const),
            generateRoomPreview,
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

/**
 * Preview path: intentional identity enrichment so terminal handling matches roomStateRender materialize's
 * enrich-then-deliver structure (`enrichRenderResolveForPassive` maps resolve output to bus payloads there).
 * Returns `output` unchanged; {@link renderResolveOutputToGenerateRoomPreviewResult} performs wire shaping.
 */
function enrichRenderResolveForPreview(output: RenderResolveOutput): RenderResolveOutput {
    return output
}
