import { QUALIFIER_PHRASES } from '../enrich/objectManipulation/plan/qualifierPrepositions'
import { peelLeadingArticleWhenTail } from './peelLeadingArticleWhenTail'

/** One closed-set preposition and the piece after it, up to the next split point. */
export type QualifierTailLink = { preposition: string; span: string }

export type QualifierTailSplit = { head: string; links: QualifierTailLink[] }

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The closed set as whole words, longest phrase first, any run of whitespace between a phrase's words. */
const QUALIFIER_PHRASE_PATTERN = new RegExp(
    `\\b(?:${QUALIFIER_PHRASES.map((phrase) => phrase.split(' ').map(escapeRegExp).join('\\s+')).join('|')})\\b`,
    'gi'
)

/**
 * Splits a command's tail at each closed-set preposition (`QUALIFIER_PHRASES`): the head piece,
 * then each preposition with the piece after it. It reads only the words, never the verb: which
 * piece a phrase attaches to is grouping's to decide (`plan/groupSkeleton.ts`). A preposition is a
 * split point only with words on both sides of it, so "off the hat" and "cup on" stay whole. Each
 * piece has its leading article peeled; the preposition is kept as typed, whitespace collapsed.
 */
export function splitQualifierTail(tail: string): QualifierTailSplit {
    const matches = [...tail.matchAll(QUALIFIER_PHRASE_PATTERN)]
    const cuts = matches.reduce<{ start: number; end: number; preposition: string }[]>((accepted, match) => {
        const start = match.index!
        const end = start + match[0].length
        const pieceStart = accepted.length > 0 ? accepted[accepted.length - 1]!.end : 0
        const hasWordsBefore = tail.slice(pieceStart, start).trim().length > 0
        const hasWordsAfter = tail.slice(end).trim().length > 0
        return hasWordsBefore && hasWordsAfter
            ? [...accepted, { start, end, preposition: match[0].replace(/\s+/g, ' ') }]
            : accepted
    }, [])
    const pieceAfter = (index: number): string => (
        peelLeadingArticleWhenTail(tail.slice(cuts[index]!.end, cuts[index + 1]?.start ?? tail.length))
    )
    return {
        head: peelLeadingArticleWhenTail(tail.slice(0, cuts[0]?.start ?? tail.length)),
        links: cuts.map(({ preposition }, index) => ({ preposition, span: pieceAfter(index) })),
    }
}
