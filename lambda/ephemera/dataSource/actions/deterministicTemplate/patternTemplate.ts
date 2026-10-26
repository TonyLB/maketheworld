import type {
    ObjectSpanToken,
    ParseSkeleton,
    ParseToken,
    ParseTokenDraft,
} from '../enrich/objectManipulation/parse/parseToken'
import { stableRefKeysByRange, stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import type { ParseCommandResult } from '../baseClasses'
import type {
    DeterministicTemplate,
    DeterministicTemplateDeferReason,
    DeterministicTemplateMatch,
    IntentFieldRole,
    PatternElement,
} from './deterministicTemplate'
import { granulesOf, optionWords, tokenize, type GranuleToken } from './granuleTokens'

/**
 * What a single pattern element captured out of a fill. `text` is the element's tokens re-joined;
 * a `templateText` capture also names the option it matched, as written in the pattern. A span's
 * capture carries its occurrence's key. An `objectPhrase` capture's `text` is its first span, and
 * each link holds a preposition (as typed, and the option it matched) and the span after it.
 */
export type PatternCapture =
    | { elementIndex: number; kind: 'templateText'; text: string; option: string }
    | { elementIndex: number; kind: 'objectSpan'; role: IntentFieldRole; text: string; stableRefKey?: string }
    | { elementIndex: number; kind: 'capturedText'; role: IntentFieldRole; text: string }
    | { elementIndex: number; kind: 'objectPhrase'; role: IntentFieldRole; text: string; stableRefKey?: string; links: ObjectPhraseLink[] }

export type ObjectPhraseLink = { text: string; option: string; span: string }

/** A run of tokens, from `start` up to (not including) `end`. */
export type TokenRange = { start: number; end: number }

/** An object phrase's spans as ranges, right-nested: a head, and optionally a preposition and the phrase after it. */
type PhraseRanges = { head: TokenRange; link?: { preposition: TokenRange; option: string; tail: PhraseRanges } }

type ElementMatch =
    | { kind: 'templateText'; range: TokenRange; option: string }
    | { kind: 'objectSpan' | 'capturedText'; range: TokenRange }
    | { kind: 'objectPhrase'; phrase: PhraseRanges }

/** One way a pattern fits a command's tokens: each element's token ranges, parallel to the pattern. */
export type TokenFill = readonly ElementMatch[]

/**
 * A fill read out: what each element captured (parallel to the pattern), the reading (each object
 * phrase's spans nested onto its first span as qualifiers), and the segmentation (the same tokens
 * flat: each fixed word a text token, each span an object span token). Two fills with the same
 * `segmentationKey` cut the command at the same token ranges.
 */
export type PatternFill = {
    captures: PatternCapture[]
    reading: ParseSkeleton
    segmentation: ParseSkeleton
    segmentationKey: string
}

/** Every fixed word a pattern reads: its fixed-word options, and each object phrase's prepositions. */
export function fixedWordsOf(pattern: readonly PatternElement[]): string[] {
    return pattern.flatMap((element) => (
        element.type === 'templateText' ? [...element.options] : element.type === 'objectPhrase' ? Object.keys(element.prepositions) : []
    ))
}

/** A run's words and marks re-joined with single spaces. */
export function tokenText(tokens: readonly GranuleToken[], { start, end }: TokenRange): string {
    return tokens.slice(start, end).flatMap((token) => (token.kind === 'punctuation' ? [token.text] : token.words)).join(' ')
}

/** The words a skeleton spells, spans and text alike, in order. */
export function skeletonText(skeleton: readonly (ParseTokenDraft | ParseToken)[]): string {
    return skeleton.map((token) => (token.type === 'objectSpan' ? token.span : token.text)).join(' ')
}

/**
 * Each option that matches the granule tokens from `index`, and where it ends. An option matches
 * a run of granule tokens whose canonical words are its words; options with the same words are one
 * (the first, as written), so no two matches here end at the same token.
 */
export function optionMatchesAt(tokens: readonly GranuleToken[], index: number, options: readonly string[]): { option: string; end: number }[] {
    const words = options.map(optionWords)
    const spelled = words.map((each) => each.join(' '))
    return options.flatMap((option, at) => {
        const end = spelled.indexOf(spelled[at]) === at ? granuleRunEnd(tokens, index, words[at]) : undefined
        return end === undefined ? [] : [{ option, end }]
    })
}

/** Where a run of granule tokens spelling `words` exactly, starting at `index`, ends. */
function granuleRunEnd(tokens: readonly GranuleToken[], index: number, words: readonly string[]): number | undefined {
    if (words.length === 0) {
        return index
    }
    const token = tokens[index]
    if (token?.kind !== 'granule' || token.granule.some((word, offset) => words[offset] !== word)) {
        return undefined
    }
    return granuleRunEnd(tokens, index + 1, words.slice(token.granule.length))
}

/** Every end of a span starting at `index`: a run of one or more tokens holding at least one word. */
function spanEnds(tokens: readonly GranuleToken[], index: number): number[] {
    const firstWord = tokens.findIndex((token, at) => at >= index && token.kind !== 'punctuation')
    return firstWord === -1 ? [] : tokens.slice(firstWord).map((_token, offset) => firstWord + offset + 1)
}

/** Every reading of an object phrase starting at `index`: a span, then optionally a preposition and another object phrase. */
function phrasesFrom(tokens: readonly GranuleToken[], index: number, prepositions: readonly string[]): { phrase: PhraseRanges; end: number }[] {
    return spanEnds(tokens, index).flatMap((headEnd) => {
        const head = { start: index, end: headEnd }
        const linked = optionMatchesAt(tokens, headEnd, prepositions).flatMap(({ option, end: prepositionEnd }) => (
            phrasesFrom(tokens, prepositionEnd, prepositions).map(({ phrase: tail, end }) => ({
                phrase: { head, link: { preposition: { start: headEnd, end: prepositionEnd }, option, tail } },
                end,
            }))
        ))
        return [{ phrase: { head }, end: headEnd }, ...linked]
    })
}

/** Every way to assign the pattern's elements, from `elementIndex` on, to the tokens from `index` on, using up both. */
function fillsFrom(pattern: readonly PatternElement[], tokens: readonly GranuleToken[], elementIndex: number, index: number): ElementMatch[][] {
    if (elementIndex === pattern.length) {
        return index === tokens.length ? [[]] : []
    }
    const element = pattern[elementIndex]
    const then = (match: ElementMatch, next: number): ElementMatch[][] => (
        fillsFrom(pattern, tokens, elementIndex + 1, next).map((rest) => [match, ...rest])
    )
    if (element.type === 'templateText') {
        return optionMatchesAt(tokens, index, element.options).flatMap(({ option, end }) => then({ kind: 'templateText', range: { start: index, end }, option }, end))
    }
    if (element.type === 'objectPhrase') {
        return phrasesFrom(tokens, index, Object.keys(element.prepositions)).flatMap(({ phrase, end }) => then({ kind: 'objectPhrase', phrase }, end))
    }
    return spanEnds(tokens, index).flatMap((end) => then({ kind: element.type, range: { start: index, end } }, end))
}

/**
 * Every way the pattern fits a command's granule tokens (`granuleTokens.ts`), each using up every
 * token. A fixed word matches a run of granule tokens equal to one of its options; a span slot takes
 * any run of one or more tokens holding a word (granule tokens and punctuation marks included, so a
 * span may merge across a template's own fixed words); an object phrase is a span, optionally
 * followed by one of its prepositions and another object phrase, right-nested, so k prepositions
 * inside it give 2^k readings. Every derivation is a distinct fill: no fill is built twice.
 */
export function matchPattern(pattern: readonly PatternElement[], tokens: readonly GranuleToken[]): TokenFill[] {
    return fillsFrom(pattern, tokens, 0, 0)
}

/** The span ranges a fill holds: each object span, and each span of each object phrase. */
function spanRangesOf(fill: TokenFill): TokenRange[] {
    const phraseRanges = (phrase: PhraseRanges): TokenRange[] => [phrase.head, ...(phrase.link ? phraseRanges(phrase.link.tail) : [])]
    return fill.flatMap((match) => (
        match.kind === 'objectSpan' ? [match.range] : match.kind === 'objectPhrase' ? phraseRanges(match.phrase) : []
    ))
}

/**
 * The fills read out, parallel to `matches`, with every span's key stamped across all of them: a
 * span's key names its token range, so one occurrence has one key in every fill
 * (`stableRefKeysByRange`). Fills of several patterns over one command are read together so their
 * keys agree.
 */
export function readFills(tokens: readonly GranuleToken[], matches: readonly { pattern: readonly PatternElement[]; fill: TokenFill }[]): PatternFill[] {
    const keyOf = stableRefKeysByRange(matches.flatMap(({ fill }) => spanRangesOf(fill)).map((range) => ({ ...range, span: tokenText(tokens, range) })))
    const spanToken = ({ start, end }: TokenRange): ObjectSpanToken => ({ type: 'objectSpan', span: tokenText(tokens, { start, end }), stableRefKey: keyOf({ start, end }) })
    const rangeKey = ({ start, end }: TokenRange, kind: string): string => `${kind}${start}-${end}`
    return matches.map(({ pattern, fill }) => {
        const elements = fill.map((match, elementIndex) => {
            const element = pattern[elementIndex]
            if (match.kind === 'templateText') {
                const token: ParseToken = { type: 'text', text: tokenText(tokens, match.range) }
                return {
                    capture: { elementIndex, kind: 'templateText', text: token.text, option: match.option } as PatternCapture,
                    reading: [token],
                    segmentation: [token],
                    keys: [rangeKey(match.range, 't')],
                }
            }
            if (match.kind === 'objectPhrase') {
                if (element.type !== 'objectPhrase') {
                    throw new Error('readFills: an object phrase match on another element')
                }
                const nested = (phrase: PhraseRanges): ObjectSpanToken => ({
                    ...spanToken(phrase.head),
                    ...(phrase.link ? { qualifier: { preposition: element.prepositions[phrase.link.option], span: nested(phrase.link.tail) } } : {}),
                })
                const links = (phrase: PhraseRanges): NonNullable<PhraseRanges['link']>[] => (phrase.link ? [phrase.link, ...links(phrase.link.tail)] : [])
                const head = spanToken(match.phrase.head)
                return {
                    capture: {
                        elementIndex,
                        kind: 'objectPhrase',
                        role: element.role,
                        text: head.span,
                        stableRefKey: head.stableRefKey,
                        links: links(match.phrase).map(({ preposition, option, tail }) => ({ text: tokenText(tokens, preposition), option, span: tokenText(tokens, tail.head) })),
                    } as PatternCapture,
                    reading: [nested(match.phrase)],
                    segmentation: [head, ...links(match.phrase).flatMap(({ preposition, tail }): ParseToken[] => [{ type: 'text', text: tokenText(tokens, preposition) }, spanToken(tail.head)])],
                    keys: [rangeKey(match.phrase.head, 's'), ...links(match.phrase).flatMap(({ preposition, tail }) => [rangeKey(preposition, 't'), rangeKey(tail.head, 's')])],
                }
            }
            if (element.type !== 'objectSpan' && element.type !== 'capturedText') {
                throw new Error('readFills: a span match on a fixed-word element')
            }
            const token: ParseToken = match.kind === 'objectSpan' ? spanToken(match.range) : { type: 'text', text: tokenText(tokens, match.range) }
            return {
                capture: (token.type === 'objectSpan'
                    ? { elementIndex, kind: 'objectSpan', role: element.role, text: token.span, stableRefKey: token.stableRefKey }
                    : { elementIndex, kind: 'capturedText', role: element.role, text: token.text }) as PatternCapture,
                reading: [token],
                segmentation: [token],
                keys: [rangeKey(match.range, token.type === 'objectSpan' ? 's' : 't')],
            }
        })
        return {
            captures: elements.map(({ capture }) => capture),
            reading: elements.flatMap(({ reading }) => reading),
            segmentation: elements.flatMap(({ segmentation }) => segmentation),
            segmentationKey: elements.flatMap(({ keys }) => keys).join(' '),
        }
    })
}

/** Every fill of one pattern over a command's tokens, read out (see `matchPattern`, `readFills`). */
export function matchPatternFills(pattern: readonly PatternElement[], tokens: readonly GranuleToken[]): PatternFill[] {
    return readFills(tokens, matchPattern(pattern, tokens).map((fill) => ({ pattern, fill })))
}

/**
 * The one generic combinator: merges a template's constant `templateIntent` with
 * role-tagged captures. `templateText` captures never contribute (every template
 * using it already fixes the relevant intent field as a constant regardless of
 * which synonym matched). Cast at the boundary -- callers are responsible for each
 * template's `templateIntent`/role vocabulary being consistent with the target
 * `ParseCommandResult` member, matching this codebase's existing comfort with
 * structural trust over runtime union validation (see deterministicChecks.ts).
 */
export function assembleIntent(templateIntent: Partial<ParseCommandResult>, captures: PatternCapture[]): ParseCommandResult {
    const roleTaggedCaptures: Record<string, string> = {}
    for (const capture of captures) {
        if (capture.kind === 'objectSpan' || capture.kind === 'capturedText') {
            roleTaggedCaptures[capture.role] = capture.text
        }
    }
    return { ...templateIntent, ...roleTaggedCaptures } as ParseCommandResult
}

/**
 * Walks matched elements and emits one ParseToken per element -- `objectSpan`
 * becomes an ObjectSpanToken, `templateText`/`capturedText` become a TextToken, and an
 * `objectPhrase` becomes its first span then a TextToken and a span per link,
 * holding the actually-matched text (not a canonicalized option), consistent with
 * this codebase's existing principle that tokens identify the actual occurrence,
 * not a canonical form (stampStableRefKeys.ts). Captures are parallel to the pattern,
 * so index lookup (not a search) is safe.
 */
export function synthesizeSkeletonFromPattern(pattern: readonly PatternElement[], captures: PatternCapture[]): ParseSkeleton {
    return stampStableRefKeys(draftFromPattern(pattern, captures))
}

/** The flat, unstamped skeleton one fill builds: each object phrase flattened to its spans and prepositions. */
export function draftFromPattern(pattern: readonly PatternElement[], captures: PatternCapture[]): ParseTokenDraft[] {
    return pattern.flatMap((element, elementIndex): ParseTokenDraft[] => {
        const capture = captures[elementIndex]
        if (element.type === 'objectSpan') {
            return [{ type: 'objectSpan', span: capture.text }]
        }
        if (capture.kind === 'objectPhrase') {
            return [
                { type: 'objectSpan', span: capture.text },
                ...capture.links.flatMap(({ text, span }): ParseTokenDraft[] => [
                    { type: 'text', text },
                    { type: 'objectSpan', span },
                ]),
            ]
        }
        return [{ type: 'text', text: capture.text }]
    })
}

/**
 * An intent row reads one fill: no fill is `noMatch`, and several fills are `noMatch`
 * too, since one `ParseCommandResult` cannot carry them (the command falls to the LLM
 * route rather than guessing). No bare-word row has a wildcard, so none has several.
 */
function matchFromFills(fills: PatternFill[], templateIntent: Partial<ParseCommandResult>): DeterministicTemplateMatch {
    if (fills.length !== 1) {
        return { type: 'noMatch' }
    }
    const [{ segmentation, captures }] = fills
    return { type: 'matched', skeleton: segmentation, intent: assembleIntent(templateIntent, captures) }
}

/**
 * The pattern-driven DeterministicTemplate factory: a plain object literal (not a
 * class instance) closing over `pattern`/`templateIntent`. Both methods match the
 * one engine over tokens cut at the pattern's own fixed words: `matchString` the
 * command's, `matchTokens` the words a skeleton spells.
 */
export function makePatternTemplate(
    pattern: readonly PatternElement[],
    templateIntent: Partial<ParseCommandResult>
): DeterministicTemplate {
    const granules = granulesOf(fixedWordsOf(pattern))
    const match = (text: string) => matchFromFills(matchPatternFills(pattern, tokenize(granules, text)), templateIntent)
    return {
        matchString(command) {
            return match(command)
        },
        matchTokens(skeleton) {
            return match(skeletonText(skeleton))
        },
    }
}

/**
 * Sibling factory to makePatternTemplate: the same engine, but a
 * structural match means "recognized shape, known-unsupported" rather than
 * "matched" -- e.g. containment language ("in"/"into") for a relational
 * command, which the current relation model (On/In/PartOf/Custom, a
 * ludicGraph edge) has no representation for at all. Always defers when any
 * fill exists; never produces `matched` or reads/assembles intent.
 */
export function makeDeferPatternTemplate(
    pattern: readonly PatternElement[],
    reason: DeterministicTemplateDeferReason
): DeterministicTemplate {
    const granules = granulesOf(fixedWordsOf(pattern))
    const defers = (text: string): DeterministicTemplateMatch => (
        matchPattern(pattern, tokenize(granules, text)).length > 0 ? { type: 'defer', reason } : { type: 'noMatch' }
    )
    return {
        matchString(command) {
            return defers(command)
        },
        matchTokens(skeleton) {
            return defers(skeletonText(skeleton))
        },
    }
}
