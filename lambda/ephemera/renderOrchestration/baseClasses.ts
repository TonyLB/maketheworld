import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraCacheMarkState } from '../renderCache/baseClasses'

/**
 * Where {@link RenderResolveInput.markState} came from. Same wire shape for cache math;
 * semantics differ for policy and future defaults.
 */
export type RenderResolveMarkProvenance = 'meta' | 'preview'

/**
 * Normalized input to the shared "resolve room render from cache / maybe generate" choke-point.
 *
 * Preview handling in `index.ts` and `requestIntake.ts` can converge on this shape after their
 * respective A-phase adapters.
 *
 * - **Preview path:** `markProvenance` is `'preview'`; `pointerHint` is omitted (no Meta pointer).
 * - **Passive path:** `markProvenance` is `'meta'`; `pointerHint` is
 *   `Meta::Room.currentCacheByPerspective[perspectiveKey]` when present.
 *
 * This type is intentionally not identical to bus messages (`RenderRequested` / `RenderPreviewRequested`):
 * correlation, targets, and delivery stay outside until an output boundary exists.
 */
export type RenderResolveInput = {
    roomId: EphemeraRoomId;
    perspective: Perspective;
    /** Marks used for pointer validation, `getExactMatch`, and generation. */
    markState: EphemeraCacheMarkState;
    markProvenance: RenderResolveMarkProvenance;
    /**
     * Optional cache row id hinted by Meta::Room pointer map for this perspective.
     * Omit or undefined to skip pointer fast-path and go straight to exact-match (after any adapter rules).
     */
    pointerHint?: EphemeraCacheId;
    /** Carried through for slow-path generation when wired. */
    allowGeneration?: boolean;
    generationContextWml?: string;
}
