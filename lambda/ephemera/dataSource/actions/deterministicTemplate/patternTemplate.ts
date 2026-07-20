import type { ParseSkeleton, ParseTokenDraft } from '../enrich/objectManipulation/parse/parseToken'
import { stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import type { ParseCommandResult } from '../baseClasses'
import type { DeterministicTemplate, IntentFieldRole, PatternElement } from './deterministicTemplate'

/** What a single pattern element captured out of a successful match. */
export type PatternCapture =
    | { elementIndex: number; kind: 'templateText'; text: string }
    | { elementIndex: number; kind: 'objectSpan'; role: IntentFieldRole; text: string; stableRefKey?: string }
    | { elementIndex: number; kind: 'capturedText'; role: IntentFieldRole; text: string }

export type PatternMatchResult =
    | { type: 'noMatch' }
    | { type: 'matched'; captures: PatternCapture[] }

function escapeRegExpLiteral(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Builds one anchored, case-insensitive regex from the pattern and matches it
 * against a raw command string. `templateText` options become a capturing
 * alternation (captured, not just validated, so skeleton synthesis can preserve
 * whichever synonym was actually typed -- see synthesizeSkeletonFromPattern).
 * `objectSpan`/`capturedText` become non-greedy bounded captures. Elements are
 * joined by `\s+`, matching this codebase's existing whitespace-collapsing
 * convention (`normalizeCommandToken`, discriminateIntent/exitResolution.ts).
 *
 * Adjacent `objectSpan`/`capturedText` elements with no intervening `templateText`
 * are unsegmentable from raw text by any deterministic grammar (not a regex
 * weakness) -- callers must not author such patterns for this engine; that
 * invariant is not validated at runtime here.
 */
export function matchPatternAgainstString(pattern: PatternElement[], command: string): PatternMatchResult {
    const trimmed = command.trim()
    const fragments = pattern.map((element) => (
        element.type === 'templateText'
            ? `(${element.options.map(escapeRegExpLiteral).join('|')})`
            : '(.+?)'
    ))
    const regex = new RegExp(`^${fragments.join('\\s+')}$`, 'i')
    const match = regex.exec(trimmed)
    if (!match) {
        return { type: 'noMatch' }
    }
    const captures: PatternCapture[] = pattern.map((element, elementIndex) => {
        const text = match[elementIndex + 1]
        if (element.type === 'templateText') {
            return { elementIndex, kind: 'templateText', text }
        }
        return { elementIndex, kind: element.type, role: element.role, text }
    })
    return { type: 'matched', captures }
}

/**
 * Positional walk of the pattern against an already-tokenized skeleton. Length
 * mismatch is an immediate `noMatch` (mirrors matchRelationalTemplate.ts's
 * `skeleton.length !== 4` gate).
 */
export function matchPatternAgainstTokens(pattern: PatternElement[], skeleton: ParseSkeleton): PatternMatchResult {
    if (pattern.length !== skeleton.length) {
        return { type: 'noMatch' }
    }
    const captures: PatternCapture[] = []
    for (let elementIndex = 0; elementIndex < pattern.length; elementIndex += 1) {
        const element = pattern[elementIndex]
        const token = skeleton[elementIndex]
        if (element.type === 'templateText') {
            if (token.type !== 'text') {
                return { type: 'noMatch' }
            }
            const normalized = token.text.trim().toLowerCase()
            if (!element.options.some((option) => option.toLowerCase() === normalized)) {
                return { type: 'noMatch' }
            }
            captures.push({ elementIndex, kind: 'templateText', text: token.text })
            continue
        }
        if (element.type === 'objectSpan') {
            if (token.type !== 'objectSpan') {
                return { type: 'noMatch' }
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
            return { type: 'noMatch' }
        }
        captures.push({ elementIndex, kind: 'capturedText', role: element.role, text: token.text })
    }
    return { type: 'matched', captures }
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
 * not a canonical form (stampStableRefKeys.ts). Called unconditionally on every
 * matchString hit -- a no-op passthrough while no pattern has an objectSpan
 * element (true of every template in this slice), real stamping once Step 2's
 * relational templates land. Captures are guaranteed parallel to pattern by both
 * engines above, so index lookup (not a search) is safe.
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
            const result = matchPatternAgainstString(pattern, command)
            if (result.type === 'noMatch') {
                return { type: 'noMatch' }
            }
            return {
                type: 'matched',
                skeleton: synthesizeSkeletonFromPattern(pattern, result.captures),
                intent: assembleIntent(templateIntent, result.captures),
            }
        },
        matchTokens(skeleton) {
            const result = matchPatternAgainstTokens(pattern, skeleton)
            if (result.type === 'noMatch') {
                return { type: 'noMatch' }
            }
            return {
                type: 'matched',
                skeleton,
                intent: assembleIntent(templateIntent, result.captures),
            }
        },
    }
}
