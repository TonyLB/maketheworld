/**
 * Discriminant for which WML **vocabulary and validation rules** apply when parsing
 * and standardizing WML into `StandardForm` and `StandardComponent` shapes.
 *
 * This is **orthogonal** to `StandardFormSemanticMode` in `./baseClasses.ts`:
 * semantic mode describes *how a StandardForm is used* (direct asset, edits, aggregation).
 * Standardize mode describes *which tags are legal* for the payload (blueprint vs ephemera wire).
 * A single form may eventually carry both notions.
 *
 * **Phase 1:** Plumbing only; behavior for `'asset'` and `'ephemeraWire'` matches pre-change
 * semantics until ephemera-only tags (e.g. `<Object>`) are implemented under `'ephemeraWire'`.
 *
 * @see {@link ./AGENT.md#semantic-modes Semantic modes} for `StandardFormSemanticMode`
 */
export type WmlStandardizeMode = 'asset' | 'ephemeraWire'

/**
 * Default when a caller omits standardize mode: **blueprint / asset** pipeline (strict;
 * no ephemera-only tags). Preserves legacy behavior.
 */
export const DEFAULT_WML_STANDARDIZE_MODE: WmlStandardizeMode = 'asset'

export const isWmlStandardizeMode = (value: unknown): value is WmlStandardizeMode =>
    value === 'asset' || value === 'ephemeraWire'

/** Optional second argument to `StandardForm` constructor. */
export type StandardFormConstructionOptions = {
    standardizeMode?: WmlStandardizeMode
}

/**
 * Resolved context for `fromSchema` on components and payloads (second parameter).
 * Facet payloads use this as an optional **third** argument after `reference`.
 */
export type StandardizeFromSchemaContext = {
    standardizeMode: WmlStandardizeMode
}

export const resolveStandardizeMode = (mode?: WmlStandardizeMode): WmlStandardizeMode =>
    mode ?? DEFAULT_WML_STANDARDIZE_MODE

export const resolveStandardizeFromSchemaContext = (
    context?: StandardizeFromSchemaContext
): StandardizeFromSchemaContext => ({
    standardizeMode: resolveStandardizeMode(context?.standardizeMode),
})
