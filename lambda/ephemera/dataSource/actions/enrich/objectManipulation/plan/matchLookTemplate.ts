import type { ParseSkeleton, ParseToken, TextToken } from '../parse/parseToken'
import type { Referent } from './ungroundedPrimitive'
import { objectSpanRef } from './ungroundedPrimitive'

const LOOK_VERBS = new Set(['look', 'l', 'examine', 'x'])

export type LookTemplateMatchResult =
    | { type: 'matched'; referent: Referent }
    | { type: 'noMatch' }

function isTextToken(token: ParseToken): token is TextToken {
    return token.type === 'text'
}

/**
 * Matches an object-directed look command's ParseSkeleton against the one closed
 * template shape this slice recognizes: TEXT(verb) OBJECTSPAN --- exactly 2 tokens.
 * No preposition/relation phrase (unlike matchRelationalTemplate) --- a describe
 * referent is singular with no relation to another referent. Only ever meaningful
 * once classify has already routed a command through Parse; this function does no
 * family/route detection itself.
 */
export function matchLookTemplate(skeleton: ParseSkeleton): LookTemplateMatchResult {
    if (skeleton.length !== 2) {
        return { type: 'noMatch' }
    }
    const [verbToken, objectToken] = skeleton
    if (!isTextToken(verbToken) || objectToken.type !== 'objectSpan') {
        return { type: 'noMatch' }
    }

    const normalizedVerb = verbToken.text.trim().toLowerCase()
    if (!LOOK_VERBS.has(normalizedVerb)) {
        return { type: 'noMatch' }
    }

    const referent = objectSpanRef(objectToken.span, objectToken.stableRefKey)
    return { type: 'matched', referent }
}
