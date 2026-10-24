import { CommandAttempt } from '../../../commandAttempt'
import { mintActionId, PositionAttemptAction } from '../../../commandAttempt/action'
import { objectSpansIn } from '../../../commandAttempt/referent'
import type { ObjectSpanToken, ParseSkeleton } from '../parse/parseToken'
import { QUALIFIER_PREPOSITIONS } from './qualifierPrepositions'
import { objectSpanRef, type ContainedByAssertion } from './planStep'

/** A span's qualifier as its assertion actions: `containedBy(span, host)`, then the host's own qualifier, if any. */
const assertionsFor = (token: ObjectSpanToken): PositionAttemptAction[] => {
    const { qualifier } = token
    if (qualifier === undefined) {
        return []
    }
    const relation = QUALIFIER_PREPOSITIONS[qualifier.preposition]
    const assertion: ContainedByAssertion = {
        kind: 'assertion',
        predicate: 'containedBy',
        subject: objectSpanRef(token.span, token.stableRefKey),
        object: objectSpanRef(qualifier.span.span, qualifier.span.stableRefKey),
        negate: false,
        ...(relation !== undefined ? { relation } : {}),
    }
    return [new PositionAttemptAction(mintActionId(), [], assertion), ...assertionsFor(qualifier.span)]
}

/**
 * Lowers the qualifiers of a reading's spans into an attempt a template built from that reading:
 * each span the attempt names that carries a qualifier gets a `containedBy` assertion action, ahead
 * of every other action, so the dry run judges it first and the last action stays the primary one.
 * No narration unit covers an assertion. Template-agnostic: it reads only the referents' keys and
 * the reading's qualifiers. An attempt naming no qualified span is returned as it is.
 */
export function lowerQualifiers(attempt: CommandAttempt, reading: ParseSkeleton): CommandAttempt {
    const qualified = new Map(reading.flatMap((token) => (
        token.type === 'objectSpan' && token.qualifier !== undefined ? [[token.stableRefKey, token] as const] : []
    )))
    if (qualified.size === 0) {
        return attempt
    }
    const keys = [...new Set(attempt.actions().flatMap((action) => action.referents().flatMap(objectSpansIn)).map((span) => span.stableRefKey))]
    const assertions = keys.flatMap((key) => {
        const token = key === undefined ? undefined : qualified.get(key)
        return token === undefined ? [] : assertionsFor(token)
    })
    if (assertions.length === 0) {
        return attempt
    }
    return CommandAttempt.create(attempt.words, [...assertions, ...attempt.actions()], attempt.narrationUnits())
}
