import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../../../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../../../renderCache/baseClasses'
import {
    toRenderInvalidate,
    type RenderPreviewRequested,
    type RenderReady,
    type RenderRequested,
} from '../../../renderOrchestration/events'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

/** Passive {@link RenderRequested} is not a room id; Meta/cache resolve does not apply. */
export const RENDER_ERROR_CODE_NOT_ROOM = 'RENDER_REQUESTED_NOT_ROOM'

const toRenderReady = (payload: RenderRequested, cacheId: EphemeraCacheId, cacheRecord: EphemeraCacheDynamoItem): RenderReady => ({
    type: 'RenderReady',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    cacheId,
    cacheRecord
})

const toMissingRoomStateError = (payload: RenderRequested) => ({
    type: 'Error' as const,
    body: {
        error: `RenderRequested requires Meta::Room.state.marks for ${payload.componentId}`,
        statusCode: 500
    }
})

const toRenderResolveFailureError = (output: Extract<RenderResolveOutput, { type: 'failed' }>) => ({
    type: 'Error' as const,
    body: {
        error: `${output.errorCode}: ${output.errorMessage}`,
        statusCode: 500
    }
})

/**
 * Passive / state-driven path: map {@link RenderResolveOutput} to `messageBus` envelopes (`RenderReady`, `RenderInvalidate`, `RenderError`, `Error`).
 */
export const deliverRenderResolveForPassive = (
    payload: RenderRequested,
    messageBus: MessageBus,
    output: RenderResolveOutput
): void => {
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            console.error('deliverRenderResolveForPassive: resolved outcome missing cacheId or cacheRecord')
            return
        }
        messageBus.send(toRenderReady(payload, cacheId, cacheRecord))
        return
    }
    if (output.type === 'invalidate') {
        messageBus.send(toRenderInvalidate(payload, output.reason))
        return
    }
    if (output.type === 'failed') {
        if (output.errorCode === 'META_ROOM_MARKS_MISSING') {
            messageBus.send(toMissingRoomStateError(payload))
            return
        }
        messageBus.send(toRenderResolveFailureError(output))
    }
}
