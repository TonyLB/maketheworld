import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    EphemeraCacheDynamoItem,
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
} from '../renderCache/baseClasses'

/**
 * Where {@link RenderResolveInput.markState} came from. Same wire shape for cache math;
 * semantics differ for policy and future defaults.
 */
export type RenderResolveMarkProvenance = 'meta' | 'preview'

/**
 * Normalized input to the shared "resolve room render from cache / maybe generate" choke-point.
 *
 * Preview handling in `index.ts` and passive intake (`requestIntake.ts`) converge on this shape via
 * A-phase adapters; the orchestration shell chains `findRender` then delivery.
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

/**
 * Error codes for {@link RenderResolveOutputFailed}. Preview failures mirror
 * `GenerateRoomPreviewFailure` in `conversations/conversationTypes/generateRoomPreview`; this union adds
 * passive-path invariants (e.g. missing `Meta::Room.state.marks`).
 */
export type RenderResolveErrorCode =
    | 'NO_EXACT_MATCH'
    | 'CONTEXT_REQUIRED'
    | 'GENERATION_FAILED'
    | 'META_ROOM_MARKS_MISSING';

/**
 * Resolve phase produced renderable output (exact match, valid pointer row, or successful generation).
 *
 * `cacheId` / `cacheRecord` are optional so callers can represent success before a durable row exists
 * or when only `renderedContent` is needed (e.g. minimal preview responses).
 */
export type RenderResolveOutputResolved = {
    type: 'resolved';
    renderedContent: EphemeraCacheRenderedContent;
    cacheId?: EphemeraCacheId;
    cacheRecord?: EphemeraCacheDynamoItem;
};

/**
 * Passive intake: no satisfying cache row in this phase; hand off to lookup / later generation policy.
 * Maps to publishing {@link RenderLookupRequested} today.
 */
export type RenderResolveOutputLookupHandoff = {
    type: 'lookup_handoff';
};

/**
 * Terminal failure inside the shared resolve story (LLM errors, missing authoring context, missing meta marks).
 */
export type RenderResolveOutputFailed = {
    type: 'failed';
    errorCode: RenderResolveErrorCode;
    errorMessage: string;
};

/**
 * Normalized **B-phase** outcome from "resolve room render from cache / maybe generate" (paired with
 * {@link RenderResolveInput}). Correlation (`conversationId`, `RenderTargetContext`, bus envelopes) stays
 * in adapters that map this to `RenderReady`, `RenderLookupRequested`, conversation steps, or `Error`.
 */
export type RenderResolveOutput =
    | RenderResolveOutputResolved
    | RenderResolveOutputLookupHandoff
    | RenderResolveOutputFailed;
