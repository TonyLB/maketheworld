import { fixedWord, objectPhrase } from '../../../deterministicTemplate/deterministicTemplate'
import type { GranuleToken } from '../../../deterministicTemplate/granuleTokens'
import { optionMatchesAt } from '../../../deterministicTemplate/patternTemplate'
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

/** The pattern element for a closed-set preposition; a capture's value is the canonical preposition. */
export const QUALIFIER_PREPOSITION_ELEMENT = fixedWord('preposition', QUALIFIER_OPTIONS)

/**
 * An object phrase linked at the closed-set prepositions, under a name: its readings nest each
 * linked span as a qualifier, with the preposition canonical.
 */
export const qualifierObjectPhraseElement = <Name extends string>(name: Name) => objectPhrase(name, QUALIFIER_OPTIONS)

/** The subject object phrase: the membership and look templates'. */
export const QUALIFIER_OBJECT_PHRASE_ELEMENT = qualifierObjectPhraseElement('subject')

/** The most closed-set prepositions a command can hold and still be read deterministically. */
export const QUALIFIER_CAP = 6

/**
 * The guard cap: a command holding more than `QUALIFIER_CAP` closed-set prepositions gets no
 * deterministic reading, so it climbs the ladder. Readings multiply with the prepositions (a
 * containment command with k of them has k * 2^(k-1)), so the cap is for pathological input only.
 * Counts the token positions where some preposition matches (`on top of` and `on` at one place
 * are one).
 */
export const exceedsQualifierCap = (tokens: readonly GranuleToken[]): boolean => (
    tokens.filter((_token, index) => optionMatchesAt(tokens, index, Object.keys(QUALIFIER_OPTIONS)).length > 0).length > QUALIFIER_CAP
)
