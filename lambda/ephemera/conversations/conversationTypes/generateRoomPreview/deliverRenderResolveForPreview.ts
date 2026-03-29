import type { ConversationCompositeReadHandleGenerateRoomPreview } from '../compositeRead'
import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'

/**
 * Preview path: forward terminal {@link RenderResolveOutput} to the conversation `generateRoomPreview` `sendMessage`.
 */
export const deliverRenderResolveForPreview = async (
    output: RenderResolveOutput,
    handle: ConversationCompositeReadHandleGenerateRoomPreview | undefined
): Promise<void> => {
    if (handle === undefined) {
        return
    }
    await handle.sendMessage(output)
}
