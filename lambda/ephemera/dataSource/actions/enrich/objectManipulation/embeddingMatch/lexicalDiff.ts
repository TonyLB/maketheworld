/**
 * The lexical difference between a span and a catalog shortName, in words: their token-aware
 * alignment (`tokenAwareAlignment.ts`) read back as the match on each side, the word pairs and the
 * edits inside them, and each side's surplus: words skipped inside the match, and on either side
 * of it the part of a word the match edge cuts into, whole words, and punctuation marks. A word is
 * what `granuleTokens.ts` calls one (`lexemesOf`), so the surplus counts words as the span was cut.
 */

import { normalizeShortNameForEmbedding } from '../../../../objects/embedding/impromptuEmbeddingNeedsRefresh'
import { lexemesOf } from '../../../deterministicTemplate/granuleTokens'

import type { FlankLengthMetrics } from './lexicalMatchMetrics'
import type { AlignmentOp } from './osaStep'
import { alignSpanToName, type WordPair } from './tokenAwareAlignment'
import type { TextRange } from './types'

/** Which string a piece of text came from: the player's span or the catalog shortName. */
export type LexicalSide = 'span' | 'name'

/** The surplus on one side of the match, as ranges in that side's text. */
export type FlankDiff = {
    /** The part, outside the match, of the word the match edge cuts into. */
    partialWord?: TextRange
    /** Words wholly outside the match. */
    words: TextRange[]
    /** Punctuation marks outside the match. */
    marks: TextRange[]
}

/** One side of the diff: its normalized text, which every range indexes, the match in it, and its surplus. */
export type SideDiff = {
    text: string
    match: TextRange
    /** Whole words inside the match paired with nothing (priced by their own rows, not as flank). */
    skipped: TextRange[]
    left: FlankDiff
    right: FlankDiff
}

export type LexicalDiff = Record<LexicalSide, SideDiff> & {
    /** Character edits inside the word pairs. */
    edits: number
    /** Words split or merged across a space inside the word pairs. */
    boundaries: number
    /** The alignment of the span's match against the name's. */
    ops: AlignmentOp[]
    pairs: WordPair[]
}

const rangeLength = ({ start, end }: TextRange): number => end - start

const flankDiffs = (text: string, { start, end }: TextRange): { left: FlankDiff; right: FlankDiff } => (
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

const sideDiff = (text: string, match: TextRange, skipped: TextRange[]): SideDiff => ({
    text,
    match,
    skipped,
    ...flankDiffs(text, match),
})

/**
 * The diff of a span against a catalog shortName, or `undefined` when either normalizes to empty
 * or no pair of their words is close enough to be one (where `lexicalRelevance` scores 0).
 */
export function lexicalDiff(span: string, shortName: string): LexicalDiff | undefined {
    const normalizedSpan = normalizeShortNameForEmbedding(span)
    const normalizedShortName = normalizeShortNameForEmbedding(shortName)
    if (normalizedSpan.length === 0 || normalizedShortName.length === 0) {
        return undefined
    }
    const alignment = alignSpanToName(normalizedSpan, normalizedShortName)
    if (alignment === undefined) {
        return undefined
    }
    return {
        span: sideDiff(normalizedSpan, alignment.span, alignment.skipped.span),
        name: sideDiff(normalizedShortName, alignment.name, alignment.skipped.name),
        edits: alignment.edits,
        boundaries: alignment.boundaries,
        ops: alignment.ops,
        pairs: alignment.pairs,
    }
}

/**
 * One side's flank lengths, as the tanh flank combine reads them: the partial words are the
 * adjoined flank, and the rest of the flank (words, marks and spaces) the remote. Words skipped
 * inside the match are not flank.
 */
export function flankLengthMetricsOf({ text, match, left, right }: SideDiff): FlankLengthMetrics {
    const adjoinedLeftLength = left.partialWord ? rangeLength(left.partialWord) : 0
    const adjoinedRightLength = right.partialWord ? rangeLength(right.partialWord) : 0
    return {
        adjoinedLeftLength,
        adjoinedRightLength,
        remoteLeftLength: match.start - adjoinedLeftLength,
        remoteRightLength: text.length - match.end - adjoinedRightLength,
    }
}
