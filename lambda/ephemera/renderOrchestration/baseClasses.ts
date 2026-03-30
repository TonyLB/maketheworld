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
    /** Carried through for slow-path generation when wired. `undefined` means default allow (true). */
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

/** Default `RenderResolveOutputInvalidate.reason` from `findRender` when cache miss and generation does not run. */
export const RENDER_INVALIDATE_REASON_NO_CACHE_NO_GENERATION = 'NO_CACHE_MATCH_AND_GENERATION_NOT_RUN' as const

/**
 * No exact cache match and `tryGeneration` returned `null` (e.g. generation disabled).
 * Delivery publishes `RenderInvalidate` so subscribers can drop stale Meta/cache hints for this perspective.
 */
export type RenderResolveOutputInvalidate = {
    type: 'invalidate';
    /** Forwarded to `RenderInvalidate.reason`. */
    reason?: string;
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
 * in adapters that map this to `RenderReady`, `RenderInvalidate`, `RenderError`, or conversation steps.
 */
export type RenderResolveOutput =
    | RenderResolveOutputResolved
    | RenderResolveOutputInvalidate
    | RenderResolveOutputFailed;

/**
 * Non-terminal orchestration frames before a terminal {@link RenderResolveOutput}.
 * Shared by passive `roomStateRender` and preview `generateRoomPreview` conversation handles.
 *
 * - `resolving` — intake / cache / pointer work (passive may emit; preview wire may ignore until supported).
 * - `generating` — LLM or slow generation in flight.
 */
export type RenderProgress = 'resolving' | 'generating';

export function isRenderProgress(arg: RenderProgress | RenderResolveOutput): arg is RenderProgress {
    return arg === 'resolving' || arg === 'generating';
}

export type RenderGenerationReturn = 'success' | 'skip' | 'fail';