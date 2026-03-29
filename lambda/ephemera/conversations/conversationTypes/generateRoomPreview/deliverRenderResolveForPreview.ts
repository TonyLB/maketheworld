import type { MessageBus } from '../../../messageBus/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import { toRenderInvalidate, type RenderPreviewRequested } from '../../../renderOrchestration/events'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

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
