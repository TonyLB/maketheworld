import type {
    ObjectSpanToken,
    ParseSkeleton,
    ParseToken,
    ParseTokenDraft,
    QualifierPreposition,
} from '../enrich/objectManipulation/parse/parseToken'
import { stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import type { ParseCommandResult } from '../baseClasses'
import type { CommandAttempt } from '../commandAttempt'
import type {
    AttemptTemplate,
    DeterministicTemplate,
    DeterministicTemplateDeferReason,
    DeterministicTemplateMatch,
    IntentFieldRole,
    PatternElement,
} from './deterministicTemplate'

/**
 * What a single pattern element captured out of a successful match. `text` is as typed; a
 * `templateText` capture also names the option it matched, as written in the pattern. A `rest`
 * capture's text is empty when nothing followed. An `objectPhrase` capture's `text` is its first
 * span (with its key, from a token match), and each link holds a preposition (as typed, and the
 * option it matched) and the span after it.
 */
export type PatternCapture =
    | { elementIndex: number; kind: 'templateText'; text: string; option: string }
    | { elementIndex: number; kind: 'objectSpan'; role: IntentFieldRole; text: string; stableRefKey?: string }
    | { elementIndex: number; kind: 'capturedText'; role: IntentFieldRole; text: string }
    | { elementIndex: number; kind: 'rest'; text: string }
    | { elementIndex: number; kind: 'objectPhrase'; role: IntentFieldRole; text: string; stableRefKey?: string; links: ObjectPhraseLink[] }

export type ObjectPhraseLink = { text: string; option: string; span: string }

/**
 * One way a pattern fits: the skeleton it builds (stamped and flat, from a string match; the
 * reading, from a token match: the input skeleton with each object phrase nested onto its first
 * span as qualifiers) and what each element captured, parallel to the pattern.
 */
export type PatternFill = { skeleton: ParseSkeleton; captures: PatternCapture[] }

function splitWords(value: string): string[] {
    return value.trim().split(/\s+/).filter((word) => word.length > 0)
}

function sameWords(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((word, index) => word.toLowerCase() === right[index].toLowerCase())
}

/** The option a whole text token equals, ignoring case and spacing; never a word inside a longer token. */
function optionForToken(options: readonly string[], text: string): string | undefined {
    const tokenWords = splitWords(text)
    return options.find((option) => sameWords(splitWords(option), tokenWords))
}

/**
 * Every way an object phrase can start at `wordIndex`: a span of one or more words, then zero or
 * more links, each a preposition equal to the next whole words and the span after it. Each
 * result says where the phrase ends.
 */
function fillObjectPhrase(
    prepositions: readonly string[],
    words: string[],
    wordIndex: number
): { text: string; links: ObjectPhraseLink[]; nextWordIndex: number }[] {
    return words.slice(wordIndex).flatMap((_word, offset) => {
        const headEnd = wordIndex + offset + 1
        const text = words.slice(wordIndex, headEnd).join(' ')
        const linked = prepositions.flatMap((option) => {
            const optionWords = splitWords(option)
            const spanStart = headEnd + optionWords.length
            if (optionWords.length === 0 || !sameWords(optionWords, words.slice(headEnd, spanStart))) {
                return []
            }
            return fillObjectPhrase(prepositions, words, spanStart).map((tail) => ({
                text,
                links: [{ text: words.slice(headEnd, spanStart).join(' '), option, span: tail.text }, ...tail.links],
                nextWordIndex: tail.nextWordIndex,
            }))
        })
        return [{ text, links: [], nextWordIndex: headEnd }, ...linked]
    })
}

/**
 * Every way to assign the pattern's elements, from `elementIndex` on, to the words from
 * `wordIndex` on, using up both. A `templateText` option must equal the next whole
 * words; a wildcard takes one or more words; an object phrase takes every cut its
 * prepositions allow.
 */
function fillWords(pattern: readonly PatternElement[], words: string[], elementIndex: number, wordIndex: number): PatternCapture[][] {
    if (elementIndex === pattern.length) {
        return wordIndex === words.length ? [[]] : []
    }
    const element = pattern[elementIndex]
    const extend = (capture: PatternCapture, nextWordIndex: number): PatternCapture[][] => (
        fillWords(pattern, words, elementIndex + 1, nextWordIndex).map((rest) => [capture, ...rest])
    )
    if (element.type === 'templateText') {
        return element.options.flatMap((option) => {
            const optionWords = splitWords(option)
            const nextWordIndex = wordIndex + optionWords.length
            if (optionWords.length === 0 || !sameWords(optionWords, words.slice(wordIndex, nextWordIndex))) {
                return []
            }
            return extend({ elementIndex, kind: 'templateText', text: words.slice(wordIndex, nextWordIndex).join(' '), option }, nextWordIndex)
        })
    }
    if (element.type === 'rest') {
        return extend({ elementIndex, kind: 'rest', text: words.slice(wordIndex).join(' ') }, words.length)
    }
    if (element.type === 'objectPhrase') {
        return fillObjectPhrase(Object.keys(element.prepositions), words, wordIndex).flatMap(({ text, links, nextWordIndex }) => (
            extend({ elementIndex, kind: 'objectPhrase', role: element.role, text, links }, nextWordIndex)
        ))
    }
    return words.slice(wordIndex).flatMap((_word, offset) => {
        const nextWordIndex = wordIndex + offset + 1
        const text = words.slice(wordIndex, nextWordIndex).join(' ')
        return extend({ elementIndex, kind: element.type, role: element.role, text }, nextWordIndex)
    })
}

/**
 * Every way the pattern fits a raw command string, matched over words: a
 * `templateText` option must equal whole words, ignoring case and spacing, and keeps
 * the words as typed (so skeleton synthesis preserves whichever synonym was typed --
 * see synthesizeSkeletonFromPattern). `objectSpan`/`capturedText` take one or more
 * words, re-joined with single spaces. A fixed word can sit inside a wildcard in one
 * fill and be the fixed word in another, so `[take, span, on, span]` against "take cup
 * on saucer on table" has two fills. Adjacent wildcards yield every split, and an
 * object phrase yields every set of cuts at its prepositions.
 *
 * No order is promised. Fills that build the same skeleton are merged (duplicate
 * options, for instance).
 */
export function matchPatternAgainstString(pattern: readonly PatternElement[], command: string): PatternFill[] {
    const fillsByKey = new Map<string, PatternFill>()
    for (const captures of fillWords(pattern, splitWords(command), 0, 0)) {
        const draft = draftFromPattern(pattern, captures)
        const key = JSON.stringify(draft)
        if (!fillsByKey.has(key)) {
            fillsByKey.set(key, { skeleton: stampStableRefKeys(draft), captures })
        }
    }
    return [...fillsByKey.values()]
}

/**
 * Every reading an object phrase can make starting at `tokenIndex`: an object span, then either
 * nothing more, or a text token equal to a preposition and another object phrase, nested onto the
 * span as its qualifier (right-nested: "cup on saucer on table" is the cup on (the saucer on the
 * table)). Each result says where the phrase ends.
 */
function fillObjectPhraseTokens(
    prepositions: Readonly<Record<string, QualifierPreposition>>,
    skeleton: ParseSkeleton,
    tokenIndex: number
): { head: ObjectSpanToken; links: ObjectPhraseLink[]; nextTokenIndex: number }[] {
    const head = skeleton[tokenIndex]
    if (head?.type !== 'objectSpan') {
        return []
    }
    const preposition = skeleton[tokenIndex + 1]
    const option = preposition?.type === 'text' ? optionForToken(Object.keys(prepositions), preposition.text) : undefined
    const linked = preposition?.type !== 'text' || option === undefined
        ? []
        : fillObjectPhraseTokens(prepositions, skeleton, tokenIndex + 2).map((tail) => ({
            head: { ...head, qualifier: { preposition: prepositions[option], span: tail.head } },
            links: [{ text: preposition.text, option, span: tail.head.span }, ...tail.links],
            nextTokenIndex: tail.nextTokenIndex,
        }))
    return [{ head, links: [], nextTokenIndex: tokenIndex + 1 }, ...linked]
}

/**
 * Every way to assign the pattern's elements, from `elementIndex` on, to the tokens from
 * `tokenIndex` on, using up both, with the reading each builds. The model's segmentation binds: a
 * `templateText` option must equal the whole text token, ignoring case and spacing, and a wildcard
 * takes exactly one token. A `rest` takes every token left, and must be the last element. An object
 * phrase takes every run of spans its prepositions link.
 */
function fillTokens(
    pattern: readonly PatternElement[],
    skeleton: ParseSkeleton,
    elementIndex: number,
    tokenIndex: number
): { captures: PatternCapture[]; reading: ParseToken[] }[] {
    if (elementIndex === pattern.length) {
        return tokenIndex === skeleton.length ? [{ captures: [], reading: [] }] : []
    }
    const element = pattern[elementIndex]
    const token = skeleton[tokenIndex]
    const extend = (capture: PatternCapture, reading: ParseToken[], nextTokenIndex: number) => (
        fillTokens(pattern, skeleton, elementIndex + 1, nextTokenIndex).map((rest) => ({
            captures: [capture, ...rest.captures],
            reading: [...reading, ...rest.reading],
        }))
    )
    if (element.type === 'rest') {
        if (elementIndex !== pattern.length - 1) {
            throw new Error('matchPatternAgainstTokens: a rest element must be the last')
        }
        const tail = skeleton.slice(tokenIndex)
        const text = tail.map((tailToken) => (tailToken.type === 'objectSpan' ? tailToken.span : tailToken.text)).join(' ')
        return extend({ elementIndex, kind: 'rest', text }, tail, skeleton.length)
    }
    if (element.type === 'objectPhrase') {
        return fillObjectPhraseTokens(element.prepositions, skeleton, tokenIndex).flatMap(({ head, links, nextTokenIndex }) => (
            extend({ elementIndex, kind: 'objectPhrase', role: element.role, text: head.span, stableRefKey: head.stableRefKey, links }, [head], nextTokenIndex)
        ))
    }
    if (token === undefined) {
        return []
    }
    if (element.type === 'templateText') {
        const option = token.type === 'text' ? optionForToken(element.options, token.text) : undefined
        return token.type !== 'text' || option === undefined
            ? []
            : extend({ elementIndex, kind: 'templateText', text: token.text, option }, [token], tokenIndex + 1)
    }
    if (element.type === 'objectSpan') {
        return token.type !== 'objectSpan'
            ? []
            : extend({ elementIndex, kind: 'objectSpan', role: element.role, text: token.span, stableRefKey: token.stableRefKey }, [token], tokenIndex + 1)
    }
    return token.type !== 'text'
        ? []
        : extend({ elementIndex, kind: 'capturedText', role: element.role, text: token.text }, [token], tokenIndex + 1)
}

/**
 * Every way the pattern fits an already-tokenized skeleton (see fillTokens). Each fill's skeleton
 * is its reading: an object phrase's spans nest onto its first span as qualifiers, and every other
 * token is the input's own, so a pattern with no object phrase reads the skeleton as it is. No
 * order is promised; fills that build the same reading are merged.
 */
export function matchPatternAgainstTokens(pattern: readonly PatternElement[], skeleton: ParseSkeleton): PatternFill[] {
    const fillsByKey = new Map<string, PatternFill>()
    for (const { captures, reading } of fillTokens(pattern, skeleton, 0, 0)) {
        const key = JSON.stringify(reading)
        if (!fillsByKey.has(key)) {
            fillsByKey.set(key, { skeleton: reading, captures })
        }
    }
    return [...fillsByKey.values()]
}

/**
 * An object template's attempts for a skeleton: one per fill, each built from that fill's
 * captures, beside the reading it was built from (whose qualifiers Plan lowers into it). Empty
 * when the pattern does not fit.
 */
export function matchAttemptTemplate(
    template: AttemptTemplate,
    skeleton: ParseSkeleton,
    command: string
): { attempt: CommandAttempt; reading: ParseSkeleton }[] {
    return matchPatternAgainstTokens(template.pattern, skeleton).map(({ skeleton: reading, captures }) => ({
        attempt: template.build(captures, command),
        reading,
    }))
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
 * becomes an ObjectSpanToken, `templateText`/`capturedText` become a TextToken, a
 * non-empty `rest` becomes one TextToken (an empty one emits nothing), and an
 * `objectPhrase` becomes its first span then a TextToken and a span per link,
 * holding the actually-matched text (not a canonicalized option), consistent with
 * this codebase's existing principle that tokens identify the actual occurrence,
 * not a canonical form (stampStableRefKeys.ts). Called on every fill of
 * matchPatternAgainstString -- a no-op passthrough while no pattern has an objectSpan
 * element (true of every template in this slice), real stamping once a template with an
 * objectSpan element lands. Captures are guaranteed parallel to pattern by both
 * engines, so index lookup (not a search) is safe.
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
        if (element.type === 'rest' && capture.text.length === 0) {
            return []
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
    const [{ skeleton, captures }] = fills
    return { type: 'matched', skeleton, intent: assembleIntent(templateIntent, captures) }
}

/**
 * The pattern-driven DeterministicTemplate factory: a plain object literal (not a
 * class instance) closing over `pattern`/`templateIntent`, delegating to the
 * generic engines/combinator/synthesis above. This is the only implementation this
 * slice builds; a future context-dependent implementation (e.g. Navigation) would
 * satisfy the same DeterministicTemplate interface without going through this
 * factory at all.
 */
export function makePatternTemplate(
    pattern: readonly PatternElement[],
    templateIntent: Partial<ParseCommandResult>
): DeterministicTemplate {
    return {
        matchString(command) {
            return matchFromFills(matchPatternAgainstString(pattern, command), templateIntent)
        },
        matchTokens(skeleton) {
            return matchFromFills(matchPatternAgainstTokens(pattern, skeleton), templateIntent)
        },
    }
}

/**
 * Sibling factory to makePatternTemplate: same two generic engines, but a
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
    return {
        matchString(command) {
            return matchPatternAgainstString(pattern, command).length > 0 ? { type: 'defer', reason } : { type: 'noMatch' }
        },
        matchTokens(skeleton) {
            return matchPatternAgainstTokens(pattern, skeleton).length > 0 ? { type: 'defer', reason } : { type: 'noMatch' }
        },
    }
}
