import type { ConversationId } from '../conversations'
import type { generateRoomPreview as generateRoomPreviewType } from './generateRoomPreview'
import type { RenderGenerationReturn, RenderProgress, RenderResolveInput, RenderResolveOutput } from './baseClasses'

export type TryGenerationDependencies = {
    generateRoomPreview: typeof generateRoomPreviewType;
    conversationId?: ConversationId;
    sendMessage?: (arg: RenderProgress | RenderResolveOutput) => Promise<void>;
};

/**
 * Slow-path generation adapter: delegates to `generateRoomPreview`.
 * Policy (`allowGeneration`) is enforced in `findRender` before this runs.
 */
export const tryGeneration = async (
    resolve: RenderResolveInput,
    deps: TryGenerationDependencies
): Promise<RenderGenerationReturn> => {
    return deps.generateRoomPreview(
        {
            roomId: resolve.roomId,
            markState: resolve.markState,
            assetStack: resolve.perspective.assetStack,
            generationContextWml: resolve.generationContextWml,
        },
        {
            conversationId: deps.conversationId,
            sendMessage: deps.sendMessage,
        }
    )
}
