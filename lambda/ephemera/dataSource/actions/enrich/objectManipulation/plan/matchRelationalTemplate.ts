import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { normalizeRelationSpan } from '../normalizeRelationSpan'
import { CommandAttempt } from '../../../commandAttempt'
import { PositionAttemptAction } from '../../../commandAttempt/action'
import { objectSpanRef } from './planStep'
import { matchContainmentPreposition } from './matchContainmentTemplate'

const ESTABLISH_VERBS = new Set(['put', 'place', 'lean', 'tie'])
const DISSOLVE_VERBS = new Set(['take', 'remove'])

export type RelationalTemplateMatchResult =
    /** An ungrounded attempt: one position action whose step is the peer relation. */
    | { type: 'matched'; attempt: CommandAttempt }
    | { type: 'noMatch' }

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

function classifyVerb(text: string): 'establishRelation' | 'dissolveRelation' | undefined {
    const normalized = text.trim().toLowerCase()
    if (ESTABLISH_VERBS.has(normalized)) return 'establishRelation'
    if (DISSOLVE_VERBS.has(normalized)) return 'dissolveRelation'
    return undefined
}

/**
 * Matches a relational command's ParseSkeleton against the one closed template
 * shape this slice recognizes: TEXT(verb) OBJECTSPAN TEXT(prep) OBJECTSPAN ---
 * exactly 4 tokens, alternating. This check is local to this function and has
 * no bearing on membership's separate, untouched deterministicChecks.ts fast
 * path. No location-disambiguating modifier attachment here -- that's iteration 6
 * (BD-24 in the taskPlanning BD-N index), deliberately out of scope. Only ever meaningful once classify has already
 * routed a command as ObjectRelateIntent; this function does no family/route
 * detection itself.
 */
export function matchRelationalTemplate(skeleton: ParseSkeleton, command: string): RelationalTemplateMatchResult {
    if (skeleton.length !== 4) {
        return { type: 'noMatch' }
    }
    const [verbToken, subjectToken, prepToken, targetToken] = skeleton
    if (
        !isTextToken(verbToken)
        || subjectToken.type !== 'objectSpan'
        || !isTextToken(prepToken)
        || targetToken.type !== 'objectSpan'
    ) {
        return { type: 'noMatch' }
    }

    const operationKind = classifyVerb(verbToken.text)
    if (!operationKind) {
        return { type: 'noMatch' }
    }

    // Containment prepositions belong to the containment template. Answering `noMatch` here keeps
    // `take X in Y` and `tie X in Y` from also planning a peer relation.
    if (matchContainmentPreposition(prepToken.text)) {
        return { type: 'noMatch' }
    }

    const subject = objectSpanRef(subjectToken.span, subjectToken.stableRefKey)
    const target = objectSpanRef(targetToken.span, targetToken.stableRefKey)

    const relation = normalizeRelationSpan(prepToken.text)

    const change = {
        kind: 'change' as const,
        primitive: operationKind,
        subject,
        target,
        ...(relation.type === 'custom'
            ? { relationKind: 'Custom' as const, relationLabel: relation.relationLabel }
            : { relationKind: relation.kind }),
    }

    return { type: 'matched', attempt: CommandAttempt.create(command, [new PositionAttemptAction([], change)]) }
}
