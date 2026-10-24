import type { PatternElement } from '../../../deterministicTemplate/deterministicTemplate'
import { matchPatternAgainstTokens } from '../../../deterministicTemplate/patternTemplate'
import type { ParseSkeleton } from '../parse/parseToken'
import { QUALIFIER_OPTIONS, QUALIFIER_PREPOSITION_ELEMENT } from './qualifierPrepositions'

/**
 * The verbs whose tail groups as a qualifier. A stand-in for "the verb does not decide" (a qualifier restricts, an argument places: the actions contract's "Qualifier"),
 * kept until grouping emits every reading and lets the dry run and selection choose.
 */
const GROUPING_VERBS = ['take', 'get']

/** The one shape that groups today: a grouping verb, the head span, a closed-set preposition, the host span. */
const GROUPING_PATTERN: readonly PatternElement[] = [
    { type: 'templateText', options: GROUPING_VERBS },
    { type: 'objectSpan', role: 'subject' },
    QUALIFIER_PREPOSITION_ELEMENT,
    { type: 'objectSpan', role: 'target' },
]

/**
 * The readings of a flat skeleton: each groups the skeleton's spans differently. A qualifier
 * attached to a span (`ObjectSpanToken.qualifier`) means the phrase restricts which thing the span
 * means; a phrase left flat modifies the verb (a destination). Today every skeleton has exactly one
 * reading: `take`/`get` followed by one span, one closed-set preposition and one span groups the
 * tail onto the head span; everything else (a `drop`'s tail, other verbs, a preposition outside the
 * set, a longer tail) stays flat.
 */
export function groupSkeleton(skeleton: ParseSkeleton): ParseSkeleton[] {
    const [fill] = matchPatternAgainstTokens(GROUPING_PATTERN, skeleton)
    if (fill === undefined) {
        return [skeleton]
    }
    const [verb, head, , host] = skeleton
    const preposition = fill.captures[2]
    if (head.type !== 'objectSpan' || host.type !== 'objectSpan' || preposition.kind !== 'templateText') {
        return [skeleton]
    }
    return [[verb, { ...head, qualifier: { preposition: QUALIFIER_OPTIONS[preposition.option], span: host } }]]
}
