import type { ParseSkeleton, QualifierPreposition } from '../enrich/objectManipulation/parse/parseToken'
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
 * `objectPhrase` is a span, optionally followed by a preposition (a key of `prepositions`) and
 * another object phrase, right-nested. Each of its readings is its own fill: the reading nests the
 * phrase's spans as qualifiers (`ObjectSpanToken.qualifier`), each preposition canonical by its
 * `prepositions` value, and the segmentation keeps them flat (span, preposition, span ...). Every
 * element is matched over the command's granule tokens (`patternTemplate.ts` `matchPattern`), and
 * no pattern leaves a tail unread.
 */
export type PatternElement =
    | { type: 'templateText'; options: readonly string[] }
    | { type: 'objectSpan'; role: IntentFieldRole }
    | { type: 'capturedText'; role: IntentFieldRole }
    | { type: 'objectPhrase'; role: IntentFieldRole; prepositions: Readonly<Record<string, QualifierPreposition>> }

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
 * and its narration unit together. Plan matches every template over the command's tokens
 * (`plan/planSkeleton.ts` `planTokens`), one attempt per fill, and pools them all rather than
 * taking the first match.
 */
export type AttemptTemplate<Name extends string = string> = {
    name: Name
    pattern: readonly PatternElement[]
    build(captures: PatternCapture[], command: string): CommandAttempt
}
