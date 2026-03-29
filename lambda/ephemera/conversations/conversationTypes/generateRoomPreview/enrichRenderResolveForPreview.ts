import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

/**
 * Preview path: seam after `findRender` -- forward terminal {@link RenderResolveOutput} to the
 * `generateRoomPreview` `sendMessage`. No extra request/bus correlation here (conversationId selects the stream);
 * `materializeGenerateRoomPreview` translates to wire.
 */
export const enrichRenderResolveForPreview = async (
    output: RenderResolveOutput,
    handle: ConversationCompositeReadHandleGenerateRoomPreview | undefined
): Promise<void> => {
    if (handle === undefined) {
        return
    }
    await handle.sendMessage(output)
}
