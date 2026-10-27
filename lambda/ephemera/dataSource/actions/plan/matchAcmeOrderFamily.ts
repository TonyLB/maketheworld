import type { ParseCommandInput, ParseCommandResult } from '../baseClasses'
import { lexemesOf } from '../deterministicTemplate/granuleTokens'
import { enrichAcmeOrder, type EnrichAcmeOrderDeps } from '../enrich/acmeOrder'

/**
 * Ordering verb lexicon, deliberately disjoint from object-manipulation's
 * membership (take/get/drop) and relational (put/place/lean/take/remove)
 * verb sets.
 */
const ORDER_VERBS = ['order', 'buy', 'purchase']

/**
 * AcmeOrder matcher (Sub-iteration 2, iteration 7, 2026-07-20; resolves CPG-4). Runs once Plan's
 * attempts are ruled out. Unlike the other command families it is not a template on the one engine:
 * its terminal step is `enrichAcmeOrder`'s own LLM call (trope/catalog affinity resolution), so it
 * isn't zero-Bedrock, and its order list is variable-length, which no pattern element reads.
 *
 * Matches the command's first word against the order-verb lexicon, requires at least one word after
 * it, and hands `enrichAcmeOrder` the command with no `intentRawOrders`, so its LLM call splits the
 * orders itself (skeletonMatcher SM-12 (b)).
 */
export async function matchAcmeOrderFamily(
    input: ParseCommandInput,
    confidence: number,
    deps: EnrichAcmeOrderDeps = {}
): Promise<ParseCommandResult | null> {
    const [verb, ...rest] = lexemesOf(input.command)
    if (!verb || verb.kind !== 'word' || !ORDER_VERBS.includes(verb.text.toLowerCase())) {
        return null
    }
    if (!rest.some(({ kind }) => kind === 'word')) {
        return null
    }
    const { result } = await enrichAcmeOrder(
        {
            command: input.command,
            occupiedStableKeys: input.occupiedStableKeys,
        },
        confidence,
        deps
    )
    return result
}
