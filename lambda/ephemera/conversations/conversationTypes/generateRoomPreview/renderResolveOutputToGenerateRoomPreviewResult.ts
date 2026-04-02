import {
    RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
    type RenderResolveOutput,
} from '../../../dataSource/renderOrchestration/baseClasses'
import type { GenerateRoomPreviewResult } from './baseClasses'

/**
 * Pure map from shared {@link RenderResolveOutput} to the `ConversationStep` `generateRoomPreview` body
 * ({@link GenerateRoomPreviewResult}). Used by `materializeGenerateRoomPreview` only.
 *
 * Always returns a terminal wire shape (including synthetic failures for `invalidate` and edge cases)
 * so the client can close loading state.
 */
export function renderResolveOutputToGenerateRoomPreviewResult(
    output: RenderResolveOutput
): GenerateRoomPreviewResult {
    if (output.type === 'invalidate') {
        return {
            success: false,
            errorCode: 'NO_EXACT_MATCH',
            errorMessage:
                output.reason !== undefined && output.reason.length > 0
                    ? output.reason
                    : `Preview resolve invalidated (${RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION}).`,
        }
    }
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord, renderedContent } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            return {
                success: false,
                errorCode: 'NO_EXACT_MATCH',
                errorMessage: 'Resolved outcome missing cacheId or cacheRecord.',
            }
        }
        return {
            success: true,
            renderedContent,
            cacheId,
            cacheRecord,
        }
    }
    const { errorCode, errorMessage } = output
    if (errorCode === 'META_ROOM_MARKS_MISSING') {
        return {
            success: false,
            errorCode: 'GENERATION_FAILED',
            errorMessage: errorMessage.length > 0 ? errorMessage : 'META_ROOM_MARKS_MISSING',
        }
    }
    return {
        success: false,
        errorCode,
        errorMessage,
    }
}
