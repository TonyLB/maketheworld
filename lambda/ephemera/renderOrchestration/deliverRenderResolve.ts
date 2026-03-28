import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { MessageBus } from '../messageBus/baseClasses'
import type { EphemeraCacheDynamoItem } from '../renderCache/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../conversations/conversationTypes'
import type { RenderLookupRequested, RenderReady, RenderRequested } from './events'
import type { RenderResolveOutput } from './baseClasses'

const toLookupRequested = (payload: RenderRequested): RenderLookupRequested => ({
    type: 'RenderLookupRequested',
    componentId: payload.componentId,
    perspective: payload.perspective,
    characterId: payload.characterId,
    targets: payload.targets,
    messageGroupId: payload.messageGroupId,
    allowGeneration: payload.allowGeneration,
    generationContextWml: payload.generationContextWml
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
 * Passive / state-driven path: map {@link RenderResolveOutput} to `messageBus` envelopes (`RenderReady`, `RenderLookupRequested`, `Error`).
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
    if (output.type === 'lookup_handoff') {
        messageBus.send(toLookupRequested(payload))
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
 * Preview path: map {@link RenderResolveOutput} to the conversation `generateRoomPreview` `sendMessage` contract.
 */
export const deliverRenderResolveForPreview = async (
    output: RenderResolveOutput,
    handle: ConversationCompositeReadHandleGenerateRoomPreview | undefined
): Promise<void> => {
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
    if (output.type === 'lookup_handoff') {
        console.error('preview path produced unexpected lookup_handoff outcome')
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
