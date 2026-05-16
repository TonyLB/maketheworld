import type { FetchThinkingResultAPIMessage } from '@tonylb/mtw-interfaces/ts/ephemera'
import { isThinkingResultEvent } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

import internalCache from '../internalCache'
import type { MessageBus } from '../messageBus/baseClasses'

export type FetchThinkingResultRequest = FetchThinkingResultAPIMessage & { RequestId?: string }

export const handleFetchThinkingResult = async (
    request: FetchThinkingResultRequest,
    bus: MessageBus
): Promise<void> => {
    const requestId = request.RequestId

    if (!requestId) {
        bus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                message: 'RequestId is required for fetchThinkingResult',
                error: 'THINKING_RESULT_MISSING_REQUEST_ID',
            },
        })
        return
    }

    if (typeof request.workItemId !== 'string' || request.workItemId.length === 0) {
        bus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: requestId,
                message: 'Invalid fetchThinkingResult request',
                error: 'THINKING_RESULT_INVALID_REQUEST',
            },
        })
        return
    }

    const result = await internalCache.ThinkingResults.get(request.workItemId)

    if (result === null) {
        bus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: requestId,
                message: `No thinking result for workItemId ${request.workItemId}`,
                error: 'THINKING_RESULT_NOT_FOUND',
            },
        })
        return
    }

    if (!isThinkingResultEvent(result)) {
        bus.send({
            type: 'ReturnValue',
            body: {
                messageType: 'Error',
                RequestId: requestId,
                message: 'Stored thinking result failed validation',
                error: 'THINKING_RESULT_INVALID_STORED',
            },
        })
        return
    }

    bus.send({
        type: 'ReturnValue',
        body: {
            messageType: 'ThinkingResult',
            RequestId: requestId,
            result,
        },
    })
}
