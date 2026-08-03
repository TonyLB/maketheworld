import type { Perspective } from '@tonylb/mtw-interfaces/ts/perspective'
import type { EphemeraCacheId } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type {
    EphemeraCacheComponentId,
    EphemeraCacheDynamoItem,
    EphemeraCacheMarkState,
    EphemeraCacheRenderedContent,
} from '../renderCache/baseClasses'

/**
 * Where {@link RenderResolveInputSuccess.markState} came from (intake-normalized; room hosts may read `Meta::Room`).
 */
export type RenderResolveMarkProvenance = 'meta'

/**
 * Successful normalized input to the shared "resolve render from cache / maybe generate" choke-point.
 *
 * Passive intake (`requestIntake.ts`) builds this from `RenderRequested` + host meta; the orchestration
 * shell chains `findRender` then delivery. Room hosts: `pointerHint` from catalog row `currentCacheId`.
 * Feature/Knowledge hosts: empty marks, catalog-only pointer (no Meta).
 *
 * This type is intentionally not identical to bus messages (`RenderRequested`):
 * correlation, targets, and delivery stay outside until an output boundary exists.
 */
export type RenderResolveInputSuccess = {
    type: 'success';
    componentId: EphemeraCacheComponentId;
    perspective: Perspective;
    /** Marks used for pointer validation, `getExactMatch`, and generation. */
    markState: EphemeraCacheMarkState;
    markProvenance: RenderResolveMarkProvenance;
    /**
     * Optional cache row id hinted by catalog `currentCacheId`.
     * Omit or undefined to skip pointer fast-path and go straight to exact-match (after any adapter rules).
     */
    pointerHint?: EphemeraCacheId;
    /** Carried through for slow-path generation when wired. `undefined` means default allow (true). */
    allowGeneration?: boolean;
}

/** Intake-level failures before B-phase resolve runs. */
export type RenderResolveInputErrorCode =
    | 'RENDER_REQUESTED_NOT_ROOM'
    | 'META_ROOM_MARKS_MISSING';

/** Error branch for the intake union; mirrors current passive intake-only error outcomes. */
export type RenderResolveInputError = {
    type: 'error';
    errorCode: RenderResolveInputErrorCode;
    errorMessage: string;
}

/** Union intake surface for resolve orchestration. */
export type RenderResolveInput =
    | RenderResolveInputSuccess
    | RenderResolveInputError;

/** Guard for the resolve-success branch. */
export const isRenderResolveInputSuccess = (arg: RenderResolveInput): arg is RenderResolveInputSuccess => arg.type === 'success'

/** Guard for the intake-error branch. */
export const isRenderResolveInputError = (arg: RenderResolveInput): arg is RenderResolveInputError => arg.type === 'error'

/**
 * Error codes for {@link RenderResolveOutputFailed}, including passive-path invariants
 * (e.g. missing `Meta::Room.state.marks`).
 */
export type RenderResolveErrorCode =
    | 'NOT_ROOM'
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
 * No exact cache match and generation did not run (e.g. `allowGeneration` false in `findRender`).
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
 * Shared by passive `roomStateRender` conversation handles.
 *
 * - `resolving` --- intake / cache / pointer work.
 * - `generating` --- LLM or slow generation in flight.
 */
export type RenderProgress = 'resolving' | 'generating';

export function isRenderProgress(arg: RenderProgress | RenderResolveOutput): arg is RenderProgress {
    return arg === 'resolving' || arg === 'generating';
}
