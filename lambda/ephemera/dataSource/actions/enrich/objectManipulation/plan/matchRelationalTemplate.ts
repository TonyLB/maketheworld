import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { normalizeRelationSpan } from '../normalizeRelationSpan'
import { CommandAttempt } from '../../../commandAttempt'
import { PositionAttemptAction } from '../../../commandAttempt/action'
import { currentHostRef, objectSpanRef } from './planStep'

const ESTABLISH_VERBS = new Set(['put', 'place', 'lean', 'tie'])
const DISSOLVE_VERBS = new Set(['take', 'remove'])

export type RelationalTemplateMatchResult =
    /** An ungrounded attempt: one position action whose step is the peer relation, or the containment move for `On`/`In`. */
    | { type: 'matched'; attempt: CommandAttempt }
    /**
     * The preposition names a kind this template cannot plan (`PartOf`, which no player phrase
     * reaches today, see `relationKind.ts`). The caller answers with `nestingRelational`.
     */
    | { type: 'declined' }
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

    const subject = objectSpanRef(subjectToken.span, subjectToken.stableRefKey)
    const target = objectSpanRef(targetToken.span, targetToken.stableRefKey)

    const normalized = normalizeRelationSpan(prepToken.text)
    if (normalized.type === 'nestingPreposition') {
        if (normalized.kind === 'PartOf') {
            return { type: 'declined' }
        }
        // A containment move is a whole-object transfer, the same step every containment producer
        // builds. The verb is not consulted, as before this slice (`dissolve` + `in` also lands here).
        return {
            type: 'matched',
            attempt: CommandAttempt.create(command, [
                new PositionAttemptAction([], {
                    kind: 'change',
                    primitive: 'transferMembership',
                    object: subject,
                    from: currentHostRef(subject),
                    to: target,
                    containment: normalized.kind,
                }),
            ]),
        }
    }

    const { relation } = normalized

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
