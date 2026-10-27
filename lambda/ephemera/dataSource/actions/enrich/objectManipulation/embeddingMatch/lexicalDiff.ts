/**
 * The lexical difference between a span and a catalog shortName, in words: Sellers' alignment read
 * back as the matched region (with the edits inside it) and the surplus on either side of it, each
 * flank cut into the part of a word the match edge cuts into, whole words, and punctuation marks.
 *
 * The shorter normalized string is the pattern P, embedded in the longer T, as `lexicalRelevance`
 * does. Sellers' free gaps lie only in T, so the only surplus it reports as words lies on T's side,
 * and the diff labels it with that side (span or catalog name). P is aligned whole: its own extra
 * characters show only as edits inside the match (`delete`, and `substitute` where they are paired
 * with nearby letters of T), never as words. A word is what `granuleTokens.ts` calls one (`lexemesOf`), so the surplus counts words
 * as the span was cut.
 */

import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'
import { lexemesOf } from '../../../deterministicTemplate/granuleTokens'

import type { FlankLengthMetrics } from './lexicalMatchMetrics'
import {
    sellersApproximateSubstringMatch,
    type AlignmentOp,
    type SellersMatchSpan,
} from './sellersApproximateSubstringMatch'

/** Which string a piece of text came from: the player's span or the catalog shortName. */
export type LexicalSide = 'span' | 'name'

/** The surplus on one side of the match, as ranges in T. */
export type FlankDiff = {
    /** The part, outside the match, of the word the match edge cuts into. */
    partialWord?: SellersMatchSpan
    /** Words wholly outside the match. */
    words: SellersMatchSpan[]
    /** Punctuation marks outside the match. */
    marks: SellersMatchSpan[]
}

export type LexicalDiff = {
    /** The shorter normalized string. */
    pattern: string
    /** The longer normalized string, which every range indexes. */
    text: string
    /** The side T came from, and so the side of every surplus word (P's surplus is edits). */
    surplusSide: LexicalSide
    match: SellersMatchSpan & { distance: number; ops: AlignmentOp[] }
    left: FlankDiff
    right: FlankDiff
}

const rangeLength = ({ start, end }: SellersMatchSpan): number => end - start

const flankDiffs = (text: string, { start, end }: SellersMatchSpan): { left: FlankDiff; right: FlankDiff } => (
    lexemesOf(text).reduce<{ left: FlankDiff; right: FlankDiff }>(({ left, right }, lexeme) => {
        const range = { start: lexeme.start, end: lexeme.start + lexeme.text.length }
        const piece = lexeme.kind === 'word' ? 'words' : 'marks'
        return {
            left: range.end <= start
                ? { ...left, [piece]: [...left[piece], range] }
                : range.start < start ? { ...left, partialWord: { start: range.start, end: start } } : left,
            right: range.start >= end
                ? { ...right, [piece]: [...right[piece], range] }
                : range.end > end ? { ...right, partialWord: { start: end, end: range.end } } : right,
        }
    }, { left: { words: [], marks: [] }, right: { words: [], marks: [] } })
)

/**
 * The diff of a span against a catalog shortName, or `undefined` when either normalizes to empty
 * (where `lexicalRelevance` scores 0). On equal lengths the span is the pattern.
 */
export function lexicalDiff(span: string, shortName: string): LexicalDiff | undefined {
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const normalizedShortName = normalizeShortNameForEmbedding(shortName)
    if (normalizedSpan.length === 0 || normalizedShortName.length === 0) {
        return undefined
    }
    const [pattern, text, surplusSide]: [string, string, LexicalSide] = normalizedSpan.length <= normalizedShortName.length
        ? [normalizedSpan, normalizedShortName, 'name']
        : [normalizedShortName, normalizedSpan, 'span']
    const { distance, matchSpan, ops } = sellersApproximateSubstringMatch(pattern, text)
    return {
        pattern,
        text,
        surplusSide,
        match: { ...matchSpan, distance, ops },
        ...flankDiffs(text, matchSpan),
    }
}

/**
 * The diff's flank lengths as `deriveFlankLengthMetrics` counts them: the partial word is the
 * adjoined flank, and the rest of the flank (words, marks and spaces) the remote. It agrees with
 * `deriveFlankLengthMetrics` except where a match edge falls inside a word holding `'`, `-` or a
 * non-ASCII letter, which that function's ASCII test cuts and a lexeme does not.
 */
export function flankLengthMetricsOf({ text, match, left, right }: LexicalDiff): FlankLengthMetrics {
    const adjoinedLeftLength = left.partialWord ? rangeLength(left.partialWord) : 0
    const adjoinedRightLength = right.partialWord ? rangeLength(right.partialWord) : 0
    return {
        adjoinedLeftLength,
        adjoinedRightLength,
        remoteLeftLength: match.start - adjoinedLeftLength,
        remoteRightLength: text.length - match.end - adjoinedRightLength,
    }
}
