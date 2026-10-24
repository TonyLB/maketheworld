import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import type { ParseCommandResult } from '../baseClasses'
import type { CommandAttempt } from '../commandAttempt'
import type { PatternCapture } from './patternTemplate'

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
 * regardless of which listed synonym matched). An option matches whole words of the
 * command text, or a whole text token of a skeleton, ignoring case and spacing; it
 * never matches a word inside a longer token. `objectSpan` is a referent slot --
 * feeds both a skeleton token and an intent field. `capturedText` is a free-text
 * slot -- feeds a skeleton text token and an intent field like `objectSpan`, but
 * carries no referent/Identify semantics (for open-ended values, e.g. a custom
 * relation label with no closed vocabulary to match against). A `templateText` capture
 * records which option matched (`option`), so a template whose words carry values (a verb's
 * narration form, a preposition's relation) looks the value up in its own typed lexicon.
 * `rest` is valid only as the last element: it takes whatever follows, zero or more words or
 * tokens of any type, and no template reads it (a tail a template leaves unread).
 * `objectPhrase` is a span followed by zero or more pairs of a preposition (one of
 * `prepositions`, matched as whole words) and another span. Against the command text it returns
 * every set of cuts as its own fill, and it emits flat tokens (span, preposition, span ...). It is
 * matched against text only; a skeleton the model built is not walked by it yet.
 */
export type PatternElement =
    | { type: 'templateText'; options: readonly string[] }
    | { type: 'objectSpan'; role: IntentFieldRole }
    | { type: 'capturedText'; role: IntentFieldRole }
    | { type: 'rest' }
    | { type: 'objectPhrase'; role: IntentFieldRole; prepositions: readonly string[] }

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

/**
 * The object templates' sibling of DeterministicTemplate: a pattern plus the function that builds
 * the template's attempt from one fill's captures. The template file holds its shape, its words
 * and its narration unit together. Matched by `matchAttemptTemplate` (patternTemplate.ts), one
 * attempt per fill; Plan pools every template's attempts rather than taking the first match.
 */
export type AttemptTemplate<Name extends string = string> = {
    name: Name
    pattern: readonly PatternElement[]
    build(captures: PatternCapture[], command: string): CommandAttempt
}
