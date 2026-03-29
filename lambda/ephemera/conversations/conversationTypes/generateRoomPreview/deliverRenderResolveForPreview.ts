import type { MessageBus } from '../../../messageBus/baseClasses'
import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import { toRenderInvalidate, type RenderPreviewRequested } from '../../../renderOrchestration/events'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

/**
 * Preview path: forward terminal {@link RenderResolveOutput} to the conversation `generateRoomPreview` `sendMessage`,
 * and publish {@link RenderInvalidate} on the bus when resolve returns `invalidate` (cache miss, generation did not run).
 */
export const deliverRenderResolveForPreview = async (
    output: RenderResolveOutput,
    handle: ConversationCompositeReadHandleGenerateRoomPreview | undefined,
    messageBus: MessageBus,
    previewPayload: RenderPreviewRequested
): Promise<void> => {
    if (output.type === 'invalidate') {
        messageBus.send(toRenderInvalidate(previewPayload, output.reason))
    }
    if (handle === undefined) {
        return
    }
    await handle.sendMessage(output)
}
