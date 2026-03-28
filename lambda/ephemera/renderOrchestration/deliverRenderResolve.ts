import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../conversations/conversationTypes'
import type {
    RenderError,
    RenderInvalidate,
    RenderPreviewRequested,
    RenderReady,
    RenderRequested,
} from './events'
import type { RenderResolveOutput } from './baseClasses'

/** Passive {@link RenderRequested} is not a room id; Meta/cache resolve does not apply. */
export const RENDER_ERROR_CODE_NOT_ROOM = 'RENDER_REQUESTED_NOT_ROOM'

const toRenderError = (
    payload: RenderRequested | RenderPreviewRequested,
    errorCode: string,
    errorMessage: string
): RenderError => ({
    type: 'RenderError',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    errorCode,
    errorMessage,
})

/**
 * Publish {@link RenderError} on the message bus (passive not-room, preview terminal errors, etc.).
 */
export const deliverRenderOrchestrationRenderError = (
    messageBus: MessageBus,
    payload: RenderRequested | RenderPreviewRequested,
    error: { errorCode: string; errorMessage: string }
): void => {
    messageBus.send(toRenderError(payload, error.errorCode, error.errorMessage))
}

const toRenderInvalidate = (
    payload: RenderRequested | RenderPreviewRequested,
    reason?: string
): RenderInvalidate => ({
    type: 'RenderInvalidate',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    ...(reason !== undefined ? { reason } : {}),
})

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

/**
 * Preview path: map {@link RenderResolveOutput} to the conversation `generateRoomPreview` `sendMessage` contract,
 * and {@link RenderInvalidate} on the bus when resolve returns `invalidate` (cache miss, generation did not run).
 */
export const deliverRenderResolveForPreview = async (
    output: RenderResolveOutput,
    handle: ConversationCompositeReadHandleGenerateRoomPreview | undefined,
    messageBus: MessageBus,
    previewPayload: RenderPreviewRequested
): Promise<void> => {
    if (output.type === 'invalidate') {
        messageBus.send(toRenderInvalidate(previewPayload, output.reason))
        return
    }
    if (handle === undefined) {
        return
    }
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            console.error('deliverRenderResolveForPreview: resolved outcome missing cacheId or cacheRecord')
            return
        }
        await handle.sendMessage({
            success: true,
            renderedContent: output.renderedContent,
            cacheId,
            cacheRecord,
        })
        return
    }
    const { errorCode, errorMessage } = output
    if (errorCode === 'META_ROOM_MARKS_MISSING') {
        console.error('preview path produced unexpected META_ROOM_MARKS_MISSING outcome')
        return
    }
    await handle.sendMessage({
        success: false,
        errorCode,
        errorMessage,
    })
}
