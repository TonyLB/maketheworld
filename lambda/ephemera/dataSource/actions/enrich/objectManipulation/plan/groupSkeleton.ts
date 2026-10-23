import type { ObjectSpanToken, ParseSkeleton, ParseToken, QualifierPreposition, TextToken } from '../parse/parseToken'

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

/** The closed set as phrases, multi-word first, so a split inside free text matches the longest phrase. */
export const QUALIFIER_PHRASES: readonly QualifierPreposition[] = (Object.keys(QUALIFIER_PREPOSITIONS) as QualifierPreposition[])
    .sort((a, b) => b.split(' ').length - a.split(' ').length)

/** Words the LLM route emits for a closed-set preposition: `out` alone is `out of` (it sometimes drops "of"). */
const PREPOSITION_ALIASES: Readonly<Record<string, QualifierPreposition>> = { out: 'out of' }

/** The canonical closed-set preposition a whole text token names, or `undefined`. */
export const matchQualifierPreposition = (text: string): QualifierPreposition | undefined => {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
    if (normalized in QUALIFIER_PREPOSITIONS) {
        return normalized as QualifierPreposition
    }
    return PREPOSITION_ALIASES[normalized]
}

/**
 * The verbs whose tail groups as a qualifier. A stand-in for "the verb does not decide" (QR-1),
 * kept until grouping emits every reading and lets the dry run and selection choose.
 */
const GROUPING_VERBS = new Set(['take', 'get'])

const isText = (token: ParseToken | undefined): token is TextToken => token?.type === 'text'
const isSpan = (token: ParseToken | undefined): token is ObjectSpanToken => token?.type === 'objectSpan'

/**
 * The readings of a flat skeleton: each groups the skeleton's spans differently. A qualifier
 * attached to a span (`ObjectSpanToken.qualifier`) means the phrase restricts which thing the span
 * means; a phrase left flat modifies the verb (a destination). Today every skeleton has exactly one
 * reading: `take`/`get` followed by one span, one closed-set preposition and one span groups the
 * tail onto the head span; everything else (a `drop`'s tail, other verbs, a preposition outside the
 * set, a longer tail) stays flat.
 */
export function groupSkeleton(skeleton: ParseSkeleton): ParseSkeleton[] {
    if (skeleton.length !== 4) {
        return [skeleton]
    }
    const [verb, head, preposition, host] = skeleton
    if (!isText(verb) || !isSpan(head) || !isText(preposition) || !isSpan(host)) {
        return [skeleton]
    }
    if (!GROUPING_VERBS.has(verb.text.trim().toLowerCase())) {
        return [skeleton]
    }
    const matched = matchQualifierPreposition(preposition.text)
    if (matched === undefined) {
        return [skeleton]
    }
    return [[verb, { ...head, qualifier: { preposition: matched, span: host } }]]
}
