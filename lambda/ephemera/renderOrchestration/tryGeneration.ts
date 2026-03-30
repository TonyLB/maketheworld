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
 * On non-skip paths this function emits progress/terminal steps through `sendMessage`
 * and returns control-only status (`success` / `fail`).
 */
export const tryGeneration = async (
    resolve: RenderResolveInput,
    deps: TryGenerationDependencies
): Promise<RenderGenerationReturn> => {
    if (resolve.allowGeneration === false) {
        return 'skip'
    }

    const result = await deps.generateRoomPreview(
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

    if (result.success) {
        const resolved: RenderResolveOutput = {
            type: 'resolved',
            renderedContent: result.renderedContent,
            cacheId: result.cacheId,
            cacheRecord: result.cacheRecord,
        }
        await deps.sendMessage?.(resolved)
        return 'success'
    }

    const failed: RenderResolveOutput = {
        type: 'failed',
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
    }
    await deps.sendMessage?.(failed)
    return 'fail'
}
