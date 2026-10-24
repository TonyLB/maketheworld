import type { PatternElement } from '../../../deterministicTemplate/deterministicTemplate'
import type { QualifierPreposition } from '../parse/parseToken'

/**
 * The closed set of prepositions that restrict which thing a span means, and the relation each
 * records on its `containedBy` assertion (absent: held there, how unspecified). Motion words
 * (`onto`, `into`) and spatial language the bindings do not hold (`under`, `behind`) are not here.
 */
export const QUALIFIER_PREPOSITIONS: Readonly<Record<QualifierPreposition, 'On' | 'In' | undefined>> = {
    'on top of': 'On',
    'out of': 'In',
    on: 'On',
    off: 'On',
    in: 'In',
    inside: 'In',
    from: undefined,
}

/**
 * Every word a pattern accepts for a closed-set preposition, and the canonical preposition it names:
 * each phrase names itself, and `out` alone is `out of` (the LLM route sometimes drops "of").
 */
export const QUALIFIER_OPTIONS: Readonly<Record<string, QualifierPreposition>> = {
    ...Object.fromEntries(Object.keys(QUALIFIER_PREPOSITIONS).map((phrase) => [phrase, phrase])),
    out: 'out of',
}

/** The pattern element for a closed-set preposition; a capture's `option` keys `QUALIFIER_OPTIONS`. */
export const QUALIFIER_PREPOSITION_ELEMENT: PatternElement = { type: 'templateText', options: Object.keys(QUALIFIER_OPTIONS) }

/** An object phrase cut at the closed-set prepositions: the fast path's flat skeleton, matched from the command text. */
export const QUALIFIER_OBJECT_PHRASE_ELEMENT: PatternElement = {
    type: 'objectPhrase',
    role: 'subject',
    prepositions: Object.keys(QUALIFIER_OPTIONS),
}
