import type { ParseSkeleton, ParseTokenDraft } from '../enrich/objectManipulation/parse/parseToken'
import { stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import type { ParseCommandResult } from '../baseClasses'
import type {
    DeterministicTemplate,
    DeterministicTemplateDeferReason,
    DeterministicTemplateMatch,
    IntentFieldRole,
    PatternElement,
} from './deterministicTemplate'

/** What a single pattern element captured out of a successful match. */
export type PatternCapture =
    | { elementIndex: number; kind: 'templateText'; text: string }
    | { elementIndex: number; kind: 'objectSpan'; role: IntentFieldRole; text: string; stableRefKey?: string }
    | { elementIndex: number; kind: 'capturedText'; role: IntentFieldRole; text: string }

/**
 * One way a pattern fits: the skeleton it builds (stamped, from a string match; the
 * input skeleton, from a token match) and what each element captured, parallel to the
 * pattern.
 */
export type PatternFill = { skeleton: ParseSkeleton; captures: PatternCapture[] }

function splitWords(value: string): string[] {
    return value.trim().split(/\s+/).filter((word) => word.length > 0)
}

function sameWords(left: string[], right: string[]): boolean {
    return left.length === right.length && left.every((word, index) => word.toLowerCase() === right[index].toLowerCase())
}

/**
 * Every way to assign the pattern's elements, from `elementIndex` on, to the words from
 * `wordIndex` on, using up both. A `templateText` option must equal the next whole
 * words; a wildcard takes one or more words.
 */
function fillWords(pattern: PatternElement[], words: string[], elementIndex: number, wordIndex: number): PatternCapture[][] {
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
            return extend({ elementIndex, kind: 'templateText', text: words.slice(wordIndex, nextWordIndex).join(' ') }, nextWordIndex)
        })
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
 * on saucer on table" has two fills. Adjacent wildcards yield every split.
 *
 * No order is promised. Fills that build the same skeleton are merged (duplicate
 * options, for instance).
 */
export function matchPatternAgainstString(pattern: PatternElement[], command: string): PatternFill[] {
    const fillsByKey = new Map<string, PatternFill>()
    for (const captures of fillWords(pattern, splitWords(command), 0, 0)) {
        const key = JSON.stringify(captures.map(({ kind, text }) => [kind, text]))
        if (!fillsByKey.has(key)) {
            fillsByKey.set(key, { skeleton: synthesizeSkeletonFromPattern(pattern, captures), captures })
        }
    }
    return [...fillsByKey.values()]
}

/**
 * Positional walk of the pattern against an already-tokenized skeleton, one token per
 * element, so at most one fill. The model's segmentation binds: a `templateText`
 * option must equal the whole text token, ignoring case and spacing (never a word
 * inside a longer token), and a wildcard takes exactly one token. Length mismatch is
 * an immediate no match.
 */
export function matchPatternAgainstTokens(pattern: PatternElement[], skeleton: ParseSkeleton): PatternFill[] {
    if (pattern.length !== skeleton.length) {
        return []
    }
    const captures: PatternCapture[] = []
    for (let elementIndex = 0; elementIndex < pattern.length; elementIndex += 1) {
        const element = pattern[elementIndex]
        const token = skeleton[elementIndex]
        if (element.type === 'templateText') {
            if (token.type !== 'text') {
                return []
            }
            const tokenWords = splitWords(token.text)
            if (!element.options.some((option) => sameWords(splitWords(option), tokenWords))) {
                return []
            }
            captures.push({ elementIndex, kind: 'templateText', text: token.text })
            continue
        }
        if (element.type === 'objectSpan') {
            if (token.type !== 'objectSpan') {
                return []
            }
            captures.push({
                elementIndex,
                kind: 'objectSpan',
                role: element.role,
                text: token.span,
                stableRefKey: token.stableRefKey,
            })
            continue
        }
        if (token.type !== 'text') {
            return []
        }
        captures.push({ elementIndex, kind: 'capturedText', role: element.role, text: token.text })
    }
    return [{ skeleton, captures }]
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
 * becomes an ObjectSpanToken, `templateText`/`capturedText` become a TextToken
 * holding the actually-matched text (not a canonicalized option), consistent with
 * this codebase's existing principle that tokens identify the actual occurrence,
 * not a canonical form (stampStableRefKeys.ts). Called on every fill of
 * matchPatternAgainstString -- a no-op passthrough while no pattern has an objectSpan
 * element (true of every template in this slice), real stamping once a template with an
 * objectSpan element lands. Captures are guaranteed parallel to pattern by both
 * engines, so index lookup (not a search) is safe.
 */
export function synthesizeSkeletonFromPattern(pattern: PatternElement[], captures: PatternCapture[]): ParseSkeleton {
    const draft: ParseTokenDraft[] = pattern.map((element, elementIndex) => {
        const capture = captures[elementIndex]
        if (element.type === 'objectSpan') {
            return { type: 'objectSpan', span: capture.text }
        }
        return { type: 'text', text: capture.text }
    })
    return stampStableRefKeys(draft)
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
    pattern: PatternElement[],
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
    pattern: PatternElement[],
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
