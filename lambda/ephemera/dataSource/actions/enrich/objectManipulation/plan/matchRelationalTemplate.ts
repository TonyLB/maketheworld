import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { normalizeRelationSpan } from '../normalizeRelationSpan'
import type { Change } from './ungroundedPrimitive'
import { objectSpanRef } from './ungroundedPrimitive'

const ESTABLISH_VERBS = new Set(['put', 'place', 'lean'])
const DISSOLVE_VERBS = new Set(['take', 'remove'])

export type RelationalTemplateMatchResult =
    | { type: 'matched'; change: Change }
    /**
     * Relation phrase was containment language ("in"/"into") -- a named outcome,
     * not folded into noMatch, since it's a known case with an existing distinct
     * error path (objectManipulationErrorMessages.nestingRelational), not
     * "didn't understand this command at all."
     */
    | { type: 'nestingDefer' }
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
export function matchRelationalTemplate(skeleton: ParseSkeleton): RelationalTemplateMatchResult {
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

    const normalized = normalizeRelationSpan(prepToken.text)
    if (normalized.type === 'nestingDefer') {
        return { type: 'nestingDefer' }
    }

    const subject = objectSpanRef(subjectToken.span, subjectToken.stableRefKey)
    const target = objectSpanRef(targetToken.span, targetToken.stableRefKey)
    const { relation } = normalized

    const change: Change = {
        kind: 'change',
        primitive: operationKind,
        subject,
        target,
        ...(relation.type === 'custom'
            ? { relationKind: 'Custom' as const, relationLabel: relation.relationLabel }
            : { relationKind: relation.kind }),
    }

    return { type: 'matched', change }
}
