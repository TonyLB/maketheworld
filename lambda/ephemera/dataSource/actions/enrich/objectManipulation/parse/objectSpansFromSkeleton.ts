import type { ObjectSpanToken, ParseSkeleton } from './parseToken'

function isObjectSpanToken(token: ParseSkeleton[number]): token is ObjectSpanToken {
    return token.type === 'objectSpan'
}

/**
 * Extracts raw span text from a Parse skeleton, in order, discarding text tokens
 * and stableRefKey -- for consumers (e.g. membership's flat rawObjectSpans) that
 * only need span text. Generic over the whole skeleton, not route-specific.
 */
export function objectSpansFromSkeleton(skeleton: ParseSkeleton): string[] {
    return skeleton
        .filter(isObjectSpanToken)
        .map((token) => token.span)
}
