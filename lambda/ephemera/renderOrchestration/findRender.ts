import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'
import type { ConversationId } from '../conversations'
import type { generateRoomPreview } from './generateRoomPreview'
import {
    RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
    type RenderProgress,
    type RenderResolveInputSuccess,
    type RenderResolveOutput,
} from './baseClasses'

/**
 * Dependencies for `findRender`: cache lookup, Meta pointer maintenance, and slow-path `generateRoomPreview`.
 */
export type FindRenderDependencies = {
    getExactMatch: (input: {
        componentId: EphemeraRoomId;
        proposedMarkState: EphemeraCacheMarkState;
        perspective: Perspective;
    }) => Promise<EphemeraCacheDynamoItem | null>;
    getCacheRecordById: (roomId: EphemeraRoomId, cacheId: EphemeraCacheId) => Promise<EphemeraCacheDynamoItem | undefined>;
    clearPerspectivePointer: (roomId: EphemeraRoomId, perspectiveKey: string) => Promise<void>;
    computePerspectiveKey: typeof computePerspectiveKey;
    markStatesEqual: (a: EphemeraCacheMarkState, b: EphemeraCacheMarkState) => boolean;
    perspectiveMatches: typeof perspectiveMatches;
    /** Terminals from pointer/exact/invalidate paths, and progress + terminals from generation (same handle as orchestration). */
    sendMessage: (arg: RenderProgress | RenderResolveOutput) => Promise<void>;
    generateRoomPreview: typeof generateRoomPreview;
    /** Correlation for `generateRoomPreview` / cache writes; passive mints per request, preview uses payload id. */
    conversationId?: ConversationId;
}

/**
 * B-phase: pointer validation (when `pointerHint` on the resolve input is set), exact-match, generation hook,
 * or `invalidate` when nothing matches and generation does not run. Single graph shared by passive and preview pipelines.
 *
 * Terminals are emitted only via the `sendMessage` dependency; there is no return payload.
 */
export const findRender = async (
    resolve: RenderResolveInputSuccess,
    deps: FindRenderDependencies
): Promise<void> => {
    const perspectiveKey = deps.computePerspectiveKey(resolve.perspective.assetStack)
    const pointerId = resolve.pointerHint

    if (pointerId !== undefined) {
        const cacheRecord = await deps.getCacheRecordById(resolve.roomId, pointerId)

        const isValid = !!(
            cacheRecord
            && deps.markStatesEqual(resolve.markState, cacheRecord.markState)
            && deps.perspectiveMatches(cacheRecord.perspectiveMatcher, resolve.perspective)
        )

        if (isValid && cacheRecord) {
            const output: RenderResolveOutput = {
                type: 'resolved',
                renderedContent: cacheRecord.renderedContent,
                cacheId: pointerId,
                cacheRecord,
            }
            await deps.sendMessage(output)
            return
        }

        try {
            await deps.clearPerspectivePointer(resolve.roomId, perspectiveKey)
        }
        catch {
            // best-effort pointer clearing; continue to slow-path handoff
        }
    }

    const exactMatch = await deps.getExactMatch({
        componentId: resolve.roomId,
        proposedMarkState: resolve.markState,
        perspective: resolve.perspective,
    })
    if (exactMatch) {
        const output: RenderResolveOutput = {
            type: 'resolved',
            renderedContent: exactMatch.renderedContent,
            cacheId: exactMatch.DataCategory as EphemeraCacheId,
            cacheRecord: exactMatch,
        }
        await deps.sendMessage(output)
        return
    }

    if (resolve.allowGeneration === false) {
        await deps.sendMessage({
            type: 'invalidate',
            reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
        })
        return
    }

    await deps.generateRoomPreview(
        {
            roomId: resolve.roomId,
            markState: resolve.markState,
            assetStack: resolve.perspective.assetStack,
            generationContextWml: resolve.generationContextWml,
        },
        {
            conversationId: deps.conversationId,
            sendMessage: deps.sendMessage,
        },
    )
}
