import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import { normalizeRelationSpan } from '../normalizeRelationSpan'
import type { Change, Referent } from './ungroundedPrimitive'
import { objectSpanRef } from './ungroundedPrimitive'

const ESTABLISH_VERBS = new Set(['put', 'place', 'lean', 'tie'])
const DISSOLVE_VERBS = new Set(['take', 'remove'])

export type RelationalTemplateMatchResult =
    | { type: 'matched'; change: Change }
    /**
     * Third outcome alongside `matched`/`noMatch`: the skeleton fit the 4-token template and the
     * preposition names a hosting kind (`On`/`In`/`PartOf`), which AB-54 models as shard
     * placement, not a relational edge -- so there's no `Change` to build. `operationKind`/
     * `subject`/`target` are already resolved by this point and carry forward for whichever
     * lane the caller routes `kind` to (`On` to the move lane, `In`/`PartOf` to
     * `objectManipulationErrorMessages.nestingRelational` until they're built).
     */
    | { type: 'nestingDefer'; kind: 'On' | 'In' | 'PartOf'; operationKind: 'establishRelation' | 'dissolveRelation'; subject: Referent; target: Referent }
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

    const subject = objectSpanRef(subjectToken.span, subjectToken.stableRefKey)
    const target = objectSpanRef(targetToken.span, targetToken.stableRefKey)

    const normalized = normalizeRelationSpan(prepToken.text)
    if (normalized.type === 'nestingDefer') {
        return { type: 'nestingDefer', kind: normalized.kind, operationKind, subject, target }
    }

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
