import type { RenderResolveOutput } from '../../../renderOrchestration/baseClasses'
import type { GenerateRoomPreviewResult } from './baseClasses'

/**
 * Outcome of mapping {@link RenderResolveOutput} to the preview conversation terminal contract.
 * - `invalidate`: publish {@link RenderInvalidate} on the bus; no `GenerateRoomPreviewResult`.
 * - `preview_terminal`: `sendMessage` with {@link GenerateRoomPreviewResult}.
 * - `no_terminal`: orchestration error; caller logs and skips delivery.
 */
export type ToGenerateRoomPreviewResultOutcome =
    | { kind: 'invalidate'; reason?: string }
    | { kind: 'preview_terminal'; result: GenerateRoomPreviewResult }
    | {
          kind: 'no_terminal'
          reason: 'resolved_missing_cache_metadata' | 'unexpected_meta_room_marks_missing'
      }

/**
 * Pure map from shared resolve output to the preview `generateRoomPreview` terminal shape (or bus-only invalidate).
 * Side effects (bus, WebSocket) stay in {@link deliverRenderResolveForPreview}.
 */
export function toGenerateRoomPreviewResult(output: RenderResolveOutput): ToGenerateRoomPreviewResultOutcome {
    if (output.type === 'invalidate') {
        return { kind: 'invalidate', reason: output.reason }
    }
    if (output.type === 'resolved') {
        const { cacheId, cacheRecord, renderedContent } = output
        if (cacheId === undefined || cacheRecord === undefined) {
            return { kind: 'no_terminal', reason: 'resolved_missing_cache_metadata' }
        }
        return {
            kind: 'preview_terminal',
            result: {
                success: true,
                renderedContent,
                cacheId,
                cacheRecord,
            },
        }
    }
    const { errorCode, errorMessage } = output
    if (errorCode === 'META_ROOM_MARKS_MISSING') {
        return { kind: 'no_terminal', reason: 'unexpected_meta_room_marks_missing' }
    }
    return {
        kind: 'preview_terminal',
        result: {
            success: false,
            errorCode,
            errorMessage,
        },
    }
}
