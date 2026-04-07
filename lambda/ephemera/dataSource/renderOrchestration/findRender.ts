import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { perspectiveMatches, computePerspectiveKey, type Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheDynamoItem, EphemeraCacheMarkState } from '../../renderCache/baseClasses'
import type { generateRoomPreview } from './generateRoomPreview'
import type { RunWithSingleFlight } from './singleFlightRenderGeneration'
import { buildOrchestrationRouting } from './orchestrationRouting'
import type { RenderOrchestrationPublishedPayload } from './publishedEvents'
import {
    RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION,
    type RenderResolveInputSuccess,
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
    generateRoomPreview: typeof generateRoomPreview;
    /** Optional: tests pass {@link passThroughSingleFlight}; production uses default from `generateRoomPreview`. */
    runWithSingleFlight?: RunWithSingleFlight;
    /** mtw.ephemera.renderOrchestration stream outbounds (six-type pass-through contract). */
    publishOrchestration: (content: RenderOrchestrationPublishedPayload) => void | Promise<void>;
}

/**
 * B-phase: pointer validation (when `pointerHint` on the resolve input is set), exact-match, generation hook,
 * or `invalidate` when nothing matches and generation does not run.
 *
 * Outcomes are emitted via `publishOrchestration` only.
 */
export const findRender = async (
    resolve: RenderResolveInputSuccess,
    deps: FindRenderDependencies
): Promise<void> => {
    const perspectiveKey = deps.computePerspectiveKey(resolve.perspective.assetStack)
    const routing = buildOrchestrationRouting(resolve.roomId, resolve.perspective, deps.computePerspectiveKey)
    const pointerId = resolve.pointerHint

    if (pointerId !== undefined) {
        const cacheRecord = await deps.getCacheRecordById(resolve.roomId, pointerId)

        const isValid = !!(
            cacheRecord
            && deps.markStatesEqual(resolve.markState, cacheRecord.markState)
            && deps.perspectiveMatches(cacheRecord.perspectiveMatcher, resolve.perspective)
        )

        if (isValid && cacheRecord) {
            await deps.publishOrchestration({
                type: 'Current Cache Valid',
                ...routing,
                cacheId: pointerId,
            })
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
        const cacheId = exactMatch.DataCategory as EphemeraCacheId
        await deps.publishOrchestration({
            type: 'Exact Match Found',
            ...routing,
            cacheId,
        })
        return
    }

    if (resolve.allowGeneration === false) {
        await deps.publishOrchestration({
            type: 'Generation Deferred',
            ...routing,
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
            publishOrchestration: deps.publishOrchestration,
            getExactMatch: deps.getExactMatch,
            runWithSingleFlight: deps.runWithSingleFlight,
        },
    )
}
