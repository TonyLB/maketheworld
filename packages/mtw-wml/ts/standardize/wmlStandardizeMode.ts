/**
 * Discriminant for which WML **wire policy** applies on a `StandardForm` instance.
 *
 * This is **orthogonal** to `StandardFormSemanticMode` in `./baseClasses.ts`:
 * semantic mode describes *how a StandardForm is used* (direct asset, edits, aggregation).
 * Standardize mode describes whether asset wire rules run in `StandardForm.validate()`
 * (`'asset'`) or are skipped (`'ephemeraWire'`).
 *
 * **Components are mode-blind:** payloads always parse wire tags/JSON they understand.
 * Freestanding `StandardRoom` / `StandardFeature` / etc. are outside the asset wire boundary.
 *
 * @see {@link ./AGENT.md#payload-vocabulary-vs-semantic-mode-standardizemode Payload vocabulary vs semantic mode}
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
 * Placeholder type for an optional `fromSchema` context parameter on components and payloads.
 * Facet payloads use it as an optional **third** argument after `reference`.
 * No fields are defined today; callers may pass `undefined`.
 */
export type StandardizeFromSchemaContext = Record<string, never>

export const resolveStandardizeMode = (mode?: WmlStandardizeMode): WmlStandardizeMode =>
    mode ?? DEFAULT_WML_STANDARDIZE_MODE
