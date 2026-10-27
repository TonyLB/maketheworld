import type { SpanStructure } from '../parse/parseToken'
import { lexicalDiff } from './lexicalDiff'
import { priceLexicalDiff } from './lexicalWeights'
import type { RelevanceNormalizationParams } from './thresholds'

/**
 * FT-8 lexical relevance entry point: the span's difference from the catalog shortName
 * (`lexicalDiff`, with the span's structure when it has one), priced by the lexical cost table (`lexicalWeights`). Scores 0 when either
 * string normalizes to empty.
 */
export function lexicalRelevance(
    span: string,
    shortName: string,
    params: RelevanceNormalizationParams = {},
    structure?: SpanStructure
): number {
    const diff = lexicalDiff(span, shortName, structure)
    return diff === undefined ? 0 : priceLexicalDiff(diff, params)
}
