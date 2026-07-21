import type { ParseCommandInput, ParseCommandResult } from '../baseClasses'
import type { ObjectSpanToken, ParseSkeleton, ParseToken } from '../enrich/objectManipulation/parse/parseToken'
import { enrichAcmeOrder, type EnrichAcmeOrderDeps } from '../enrich/acmeOrder'

function isObjectSpanToken(token: ParseToken): token is ObjectSpanToken {
    return token.type === 'objectSpan'
}

/**
 * Ordering verb lexicon, deliberately disjoint from object-manipulation's
 * membership (take/get/drop) and relational (put/place/lean/take/remove)
 * verb sets.
 */
const ORDER_VERBS = ['order', 'buy', 'purchase']

/**
 * Plan-stage AcmeOrder matcher (Sub-iteration 2, iteration 7, 2026-07-20;
 * resolves CPG-4). Runs post-Parse, once `classifySkeletonFamily` has already
 * ruled out membership/relational for this skeleton -- unlike the other five
 * families' matchers, this one isn't a `DeterministicTemplate` entry: its
 * terminal step is `enrichAcmeOrder`'s own LLM call (trope/catalog affinity
 * resolution), so it isn't zero-Bedrock, and its span list is variable-length
 * (one or more ordered items), which doesn't fit `matchPatternAgainstTokens`'s
 * fixed-length positional engine.
 *
 * Matches the skeleton's leading `text` token against the order-verb lexicon,
 * requires at least one following `objectSpan` token, and extracts their span
 * text as `rawOrders` (interstitial text like "and"/"," is ignored). On match,
 * `enrichAcmeOrder`'s existing LLM call becomes this family's Synthesize step
 * as-is -- no new hook needed.
 */
export async function matchAcmeOrderFamily(
    skeleton: ParseSkeleton,
    input: ParseCommandInput,
    confidence: number,
    deps: EnrichAcmeOrderDeps = {}
): Promise<ParseCommandResult | null> {
    const [leading, ...rest] = skeleton
    if (!leading || leading.type !== 'text') {
        return null
    }
    const normalizedVerb = leading.text.trim().toLowerCase()
    if (!ORDER_VERBS.includes(normalizedVerb)) {
        return null
    }
    const rawOrders = rest
        .filter(isObjectSpanToken)
        .map((token) => token.span)
    if (rawOrders.length === 0) {
        return null
    }
    const { result } = await enrichAcmeOrder(
        {
            command: input.command,
            occupiedStableKeys: input.occupiedStableKeys,
            intentRawOrders: rawOrders,
        },
        confidence,
        deps
    )
    return result
}
