import type { MessageBus } from '../../../messageBus/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import { toRenderInvalidate, type RenderPreviewRequested } from '../../../renderOrchestration/events'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'
import { toGenerateRoomPreviewResult } from './toGenerateRoomPreviewResult'

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
    const mapped = toGenerateRoomPreviewResult(output)
    if (mapped.kind === 'invalidate') {
        messageBus.send(toRenderInvalidate(previewPayload, mapped.reason))
        return
    }
    if (mapped.kind === 'no_terminal') {
        if (mapped.reason === 'resolved_missing_cache_metadata') {
            console.error('deliverRenderResolveForPreview: resolved outcome missing cacheId or cacheRecord')
        } else {
            console.error('preview path produced unexpected META_ROOM_MARKS_MISSING outcome')
        }
        return
    }
    if (handle === undefined) {
        return
    }
    await handle.sendMessage(mapped.result)
}
