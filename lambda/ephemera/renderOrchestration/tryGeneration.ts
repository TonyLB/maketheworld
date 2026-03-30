import type { ConversationId } from '../conversations'
import type { generateRoomPreview as generateRoomPreviewType } from './generateRoomPreview'
import type { RenderGenerationReturn, RenderProgress, RenderResolveInput, RenderResolveOutput } from './baseClasses'

export type TryGenerationDependencies = {
    generateRoomPreview: typeof generateRoomPreviewType;
    conversationId?: ConversationId;
    sendMessage?: (arg: RenderProgress | RenderResolveOutput) => Promise<void>;
};

/**
 * Shared slow-path generation adapter for preview and passive orchestration.
 *
 * `allowGeneration` defaults to `true`; only explicit `false` returns `skip`.
 * On non-skip paths, `generateRoomPreview` emits progress/terminal steps through `sendMessage`;
 * this function returns the same control-only status (`success` / `fail`) without duplicating delivery.
 */
export const tryGeneration = async (
    resolve: RenderResolveInput,
    deps: TryGenerationDependencies
): Promise<RenderGenerationReturn> => {
    if (resolve.allowGeneration === false) {
        return 'skip'
    }

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
