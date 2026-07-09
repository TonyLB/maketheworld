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
