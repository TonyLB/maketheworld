import type { QualifierPreposition } from '../enrich/objectManipulation/parse/parseToken'
import type { AttemptKind, CommandAttempt } from '../commandAttempt'

/**
 * A fixed word: its options are its lexicon's keys, ignoring case and spacing, and each option's
 * value is what a capture hands the builder (a verb's narration form, a phrase's containment kind),
 * so a lexicon has one home, the element that reads it. An option matches a run of whole words of
 * the command, never a word inside a longer token. Named when a builder reads it.
 */
export type FixedWordElement<Name extends string = string, Value = unknown> = {
    type: 'templateText'
    name?: Name
    lexicon: Readonly<Record<string, Value>>
}

/** A referent slot: a span Identify grounds. */
export type ObjectSpanElement<Name extends string = string> = { type: 'objectSpan'; name: Name }

/**
 * A free-text slot: a span with no referent or Identify semantics (for open-ended values, e.g. a
 * custom relation label with no closed vocabulary to match against).
 */
export type CapturedTextElement<Name extends string = string> = { type: 'capturedText'; name: Name }

/**
 * A span, optionally followed by a preposition (a key of `prepositions`) and another object phrase,
 * right-nested. Each of its readings is its own fill: the reading nests the phrase's spans as
 * qualifiers (`ObjectSpanToken.qualifier`), each preposition canonical by its `prepositions` value,
 * and the segmentation keeps them flat (span, preposition, span ...).
 */
export type ObjectPhraseElement<Name extends string = string> = {
    type: 'objectPhrase'
    name: Name
    prepositions: Readonly<Record<string, QualifierPreposition>>
}

/**
 * A single slot in a pattern. Every element is matched over the command's granule tokens
 * (`patternTemplate.ts` `matchPattern`), no pattern leaves a tail unread, and a fill's captures are
 * keyed by element name (`CapturesOf`).
 */
export type PatternElement = FixedWordElement | ObjectSpanElement | CapturedTextElement | ObjectPhraseElement

/** A named fixed word over its typed lexicon. */
export const fixedWord = <Name extends string, Value>(name: Name, lexicon: Readonly<Record<string, Value>>): FixedWordElement<Name, Value> => (
    { type: 'templateText', name, lexicon }
)

/** An unnamed fixed word whose options are its own values: matched for shape, read by nothing. */
export const words = (...options: string[]): FixedWordElement<never, string> => (
    { type: 'templateText', lexicon: Object.fromEntries(options.map((option) => [option, option])) }
)

/** A named object phrase linked at `prepositions`. */
export const objectPhrase = <Name extends string>(name: Name, prepositions: Readonly<Record<string, QualifierPreposition>>): ObjectPhraseElement<Name> => (
    { type: 'objectPhrase', name, prepositions }
)

/** What a fixed word captured: its tokens re-joined, the option it matched as the lexicon writes it, and that option's value. */
export type FixedWordCapture<Value = unknown> = { kind: 'templateText'; text: string; option: string; value: Value }
/** What a referent slot captured, with its occurrence's key. */
export type ObjectSpanCapture = { kind: 'objectSpan'; text: string; stableRefKey: string }
export type CapturedTextCapture = { kind: 'capturedText'; text: string }
/** An object phrase's first span (what its qualifiers restrict), with its key, and each link's preposition (as typed, and the option it matched) and the span after it. */
export type ObjectPhraseCapture = { kind: 'objectPhrase'; text: string; stableRefKey: string; links: ObjectPhraseLink[] }
export type ObjectPhraseLink = { text: string; option: string; span: string }

export type PatternCapture = FixedWordCapture | ObjectSpanCapture | CapturedTextCapture | ObjectPhraseCapture

type CaptureOf<Element> = Element extends FixedWordElement<string, infer Value>
    ? FixedWordCapture<Value>
    : Element extends ObjectSpanElement ? ObjectSpanCapture
    : Element extends CapturedTextElement ? CapturedTextCapture
    : Element extends ObjectPhraseElement ? ObjectPhraseCapture
    : never

type NameOf<Element> = Element extends { name?: infer Name } ? (Name extends string ? Name : never) : never

/** A pattern's captures, keyed by element name: a builder reading a name its pattern lacks fails `tsc`. */
export type CapturesOf<Pattern extends readonly PatternElement[]> = {
    [Element in Pattern[number] as NameOf<Element>]: CaptureOf<Element>
}

/** The first name a pattern uses twice, or never. */
type RepeatedName<Pattern extends readonly unknown[], Seen extends string = never> = Pattern extends readonly [infer Head, ...infer Rest]
    ? [NameOf<Head> & Seen] extends [never] ? RepeatedName<Rest, Seen | NameOf<Head>> : NameOf<Head> & Seen
    : never

/**
 * An object template: a pattern plus the function that builds
 * the template's attempt from one fill's captures, by name. The template file holds its shape, its
 * words and its narration unit together. Plan matches every template over the command's tokens
 * (`plan/planSkeleton.ts` `planTokens`), one attempt per fill, and pools them all rather than
 * taking the first match. The template's name is the kind of every attempt it builds.
 */
export type AttemptTemplate<Pattern extends readonly PatternElement[] = readonly PatternElement[]> = {
    name: AttemptKind
    pattern: Pattern
    build(captures: CapturesOf<Pattern>, command: string): CommandAttempt
}

/**
 * An object template, its captures typed from its pattern; a pattern using one name twice is
 * rejected. (`readonly []` in the constraint makes the pattern infer as a tuple.)
 */
export const defineAttemptTemplate = <Pattern extends readonly [] | readonly PatternElement[]>(
    template: AttemptTemplate<Pattern> & ([RepeatedName<Pattern>] extends [never] ? unknown : { repeatedName: RepeatedName<Pattern> })
): AttemptTemplate<Pattern> => template
