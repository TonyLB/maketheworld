import { normalizeExitName } from '../../normalizeExitName'
import { normalizeShortNameForEmbedding } from '../../../objects/embedding/impromptuEmbeddingNeedsRefresh'

const LEADING_ARTICLES = ['an', 'a', 'the', 'some'] as const

/**
 * Peel a leading article (a / an / the / some) and trailing whitespace when non-empty
 * content remains; otherwise return the trimmed span unchanged.
 */
export function peelLeadingArticleWhenTail(rawSpan: string): string {
    const trimmed = rawSpan.trim()
    return LEADING_ARTICLES.reduce<string | null>((result, article) => {
        if (result !== null) {
            return result
        }
        const pattern = new RegExp(`^${article}\\s+`, 'i')
        if (!pattern.test(trimmed)) {
            return null
        }
        const peeled = trimmed.replace(pattern, '').trim()
        return peeled.length > 0 ? peeled : trimmed
    }, null) ?? trimmed
}

/**
 * The normalized forms a span matches a name by, in order: as given, then with its leading article
 * peeled when that differs. A name that starts with an article ("the thing") still matches whole;
 * "the cup" also matches "cup". Never an empty form.
 */
export function spanMatchForms(rawSpan: string): string[] {
    const forms = [normalizeExitName(rawSpan), normalizeExitName(peelLeadingArticleWhenTail(rawSpan))]
    return [...new Set(forms)].filter((form) => form.length > 0)
}

const NAME_SUBSEQUENCE_MIN_CHARS = 3

/**
 * Whether the span's words appear among the name's words in the same order, gaps allowed, whole
 * words only ("cup" matches "big red cup", not "cupboard"). The span is read as the SpanEmbeddings
 * key form: leading article peeled, then normalized; under three characters, or a bare article, never matches.
 */
export function spanIsNameSubsequence(rawSpan: string, normalizedShortName: string): boolean {
    const span = normalizeShortNameForEmbedding(peelLeadingArticleWhenTail(rawSpan))
    if (span.length < NAME_SUBSEQUENCE_MIN_CHARS || (LEADING_ARTICLES as readonly string[]).includes(span)) {
        return false
    }
    const nameWords = normalizedShortName.split(' ')
    const unmatched = span.split(' ').reduce<string[] | undefined>((remaining, word) => {
        if (!remaining) {
            return undefined
        }
        const at = remaining.indexOf(word)
        return at < 0 ? undefined : remaining.slice(at + 1)
    }, nameWords)
    return unmatched !== undefined
}
