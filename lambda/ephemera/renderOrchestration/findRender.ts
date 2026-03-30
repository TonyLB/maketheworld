import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../renderCache/baseClasses'
import { RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION, type RenderGenerationReturn, type RenderResolveInput, type RenderResolveOutput } from './baseClasses'

/**
 * Dependencies for {@link findRender}: cache lookup, Meta pointer maintenance, and optional generation.
 * Generation is injected so preview (fixed conversation) and passive (pre-registered roomStateRender id) stay outside.
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
    sendMessage: (output: RenderResolveOutput) => Promise<void>;
    /** Slow path after exact-match miss. Return `skip` to fall through to `invalidate`. */
    tryGeneration: (resolve: RenderResolveInput) => Promise<RenderGenerationReturn>;
}

/**
 * B-phase: pointer validation (when {@link RenderResolveInput.pointerHint} is set), exact-match, generation hook,
 * or `invalidate` when nothing matches and generation does not run. Single graph shared by passive and preview pipelines.
 */
export const findRender = async (
    resolve: RenderResolveInput,
    deps: FindRenderDependencies
): Promise<RenderResolveOutput | undefined> => {
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
            return output
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
        return output
    }

    const generated = await deps.tryGeneration(resolve)
    if (generated === 'success' || generated === 'fail') {
        return undefined
    }
    const output: RenderResolveOutput = {
        type: 'invalidate',
        reason: RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
    }
    await deps.sendMessage(output)
    return output
}
