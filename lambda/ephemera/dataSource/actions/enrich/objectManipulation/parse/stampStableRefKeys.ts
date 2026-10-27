import type { SpanCatalog } from '../../../deterministicTemplate/deterministicTemplate'
import type { ParseSkeleton, ParseTokenDraft } from './parseToken'

/**
 * camelCases a span for use as a stableRefKey base -- splits on any run of
 * non-alphanumeric characters, lowercases the first word, capitalizes the rest.
 * Falls back to "span" if nothing alphanumeric survives (defensive; spans are
 * already validated non-empty, but camelCasing could in principle strip everything).
 */
function camelCaseSpan(span: string): string {
    const words = span.split(/[^a-zA-Z0-9]+/).filter((word) => word.length > 0)
    if (words.length === 0) {
        return 'span'
    }
    return words
        .map((word, index) => (index === 0
            ? word.toLowerCase()
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
        .join('')
}

/**
 * Assigns stableRefKey to each objectSpan token: a camelCased, "Ref"-suffixed
 * derivation of its span text ("bag" -> bagRef), identifying this occurrence, not
 * the real-world object it may resolve to. When two tokens camelCase to the same
 * base ("put bench on bench"), both get a numeric suffix (benchRef1, benchRef2) --
 * deliberately not just the second one, so neither reads as more "canonical" than
 * the other, and neither looks like a pre-individuated proper name (avoids implying
 * two already-distinct objects, which Grounding must not presuppose -- see BD-23).
 * Unique bases stay unsuffixed. Text tokens are left untouched.
 */
/**
 * The keys of a command's span occurrences, each a token range with its text, as the matcher's
 * fills hold them (`deterministicTemplate/patternTemplate.ts` `readFills`). A key names a range,
 * so one occurrence has the same key in every fill that holds it. The base is the same
 * camelCased text as `stampStableRefKeys`; when ranges of more than one occurrence share a base
 * ("put bench on bench"), every one is numbered in the order the ranges start, for the same reason.
 * Listing a range more than once is harmless. A range read against exits is its own occurrence,
 * keyed apart from the same range read against objects (`northExitRef`), so a key names one pool.
 */
export function stableRefKeysByRange(
    spans: readonly { start: number; end: number; span: string; catalog?: SpanCatalog }[]
): (range: { start: number; end: number; catalog?: SpanCatalog }) => string {
    const rangeKey = ({ start, end, catalog }: { start: number; end: number; catalog?: SpanCatalog }): string => `${catalog ?? ''}${start}-${end}`
    const distinct = [...new Map(spans.map((span) => [rangeKey(span), span] as const)).values()]
        .sort((left, right) => left.start - right.start || left.end - right.end)
    const byBase = distinct.reduce<Map<string, string[]>>((map, span) => {
        const base = `${camelCaseSpan(span.span)}${span.catalog === 'exits' ? 'Exit' : ''}`
        return map.set(base, [...(map.get(base) ?? []), rangeKey(span)])
    }, new Map())
    const keys = new Map([...byBase.entries()].flatMap(([base, ranges]) => ranges.map((range, index) => (
        [range, ranges.length === 1 ? `${base}Ref` : `${base}Ref${index + 1}`] as const
    ))))
    return (range) => {
        const key = keys.get(rangeKey(range))
        if (key === undefined) {
            throw new Error(`stableRefKeysByRange: no span at ${rangeKey(range)}`)
        }
        return key
    }
}

export function stampStableRefKeys(tokens: readonly ParseTokenDraft[]): ParseSkeleton {
    const bases = tokens.map((token) => (token.type === 'objectSpan' ? camelCaseSpan(token.span) : undefined))
    const counts = new Map<string, number>()
    for (const base of bases) {
        if (base !== undefined) {
            counts.set(base, (counts.get(base) ?? 0) + 1)
        }
    }
    const seen = new Map<string, number>()
    return tokens.map((token, index) => {
        if (token.type !== 'objectSpan') {
            return token
        }
        const base = bases[index] as string
        if ((counts.get(base) ?? 0) <= 1) {
            return { ...token, stableRefKey: `${base}Ref` }
        }
        const occurrence = (seen.get(base) ?? 0) + 1
        seen.set(base, occurrence)
        return { ...token, stableRefKey: `${base}Ref${occurrence}` }
    })
}
