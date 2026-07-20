import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import type { ParseCommandResult } from '../baseClasses'

/**
 * Fields a matched pattern element can feed into a template's assembled intent.
 * Starts with roles Step 2's relational templates need (`target`/`relationLabel`
 * have no producer yet) because this slice's own tests must exercise `objectSpan`/
 * `capturedText` matching directly, ahead of Step 2 depending on it. Extend as new
 * templates need new fields.
 */
export type IntentFieldRole = 'subject' | 'target' | 'relationLabel'

/**
 * A single slot in a DeterministicTemplate's pattern. `templateText` is a
 * closed-vocabulary gate -- matched purely to validate shape, never captured into
 * intent (every template using it fixes the relevant intent field as a constant,
 * regardless of which listed synonym matched). `objectSpan` is a referent slot --
 * feeds both a skeleton token and an intent field. `capturedText` is a free-text
 * slot -- feeds a skeleton text token and an intent field like `objectSpan`, but
 * carries no referent/Identify semantics (for open-ended values, e.g. a custom
 * relation label with no closed vocabulary to match against).
 */
export type PatternElement =
    | { type: 'templateText'; options: string[] }
    | { type: 'objectSpan'; role: IntentFieldRole }
    | { type: 'capturedText'; role: IntentFieldRole }

/**
 * No producer in this slice -- the first is Step 2's relational containment bucket
 * (put/place ... in/into ...). Declared now so DeterministicTemplateMatch's `defer`
 * arm has a stable shape.
 */
export type DeterministicTemplateDeferReason = 'nesting'

export type DeterministicTemplateMatch =
    | { type: 'noMatch' }
    | { type: 'matched'; skeleton: ParseSkeleton; intent: ParseCommandResult }
    | { type: 'defer'; reason: DeterministicTemplateDeferReason }

/**
 * A structural contract, not a class -- any value with this method shape conforms,
 * whether produced by the pattern-driven factory (patternTemplate.ts, the only
 * implementation this slice builds) or, someday, a context-dependent implementation
 * (e.g. Navigation's exit resolution) that needs fields ParseCommandInput carries
 * beyond raw command text or a skeleton. Deliberately isolated in its own module so
 * a future implementation can depend on this contract alone.
 */
export interface DeterministicTemplate {
    matchString(command: string): DeterministicTemplateMatch
    matchTokens(skeleton: ParseSkeleton): DeterministicTemplateMatch
}
