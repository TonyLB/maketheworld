import type { ParseCommandInput, ParseCommandResult } from '../baseClasses'
import { normalizeCommandToken, navigationIntentErrorMessages, resolveExitLabelToTargetId } from '../discriminateIntent/exitResolution'

/**
 * Movement-verb lexicon, deliberately disjoint from object-manipulation's
 * membership (take/get/drop) and relational (put/place/lean/take/remove)
 * verb sets. `go` is intentionally excluded here -- deterministicChecks.ts's
 * pre-classify `maybeDeterministicNavigationResult` already owns bare `go
 * <exit>` (and bare exit names with no verb at all); this matcher only adds
 * the paraphrase verbs that fast path doesn't recognize, so a `go`-prefixed
 * command never reaches classify/Command in the first place.
 */
const MOVEMENT_VERBS = ['head', 'walk', 'move', 'travel', 'enter']

/**
 * Plan-stage Navigation paraphrase matcher (Sub-iteration 2, iteration 7,
 * 2026-07-20). Not a `DeterministicTemplate` -- that interface's
 * `matchString(command: string)` doesn't carry `ParseCommandInput.roomExits`,
 * which exit resolution genuinely needs; widening the shared interface for
 * this one case was scoped out (see AGENT.classifyPlanGeneralization.planning.md,
 * CPG-1). Runs pre-Parse, zero Bedrock cost.
 *
 * An explicit movement verb makes "this was a navigation attempt" unambiguous,
 * so a resolution failure here surfaces as a specific Error (reconnecting
 * `navigationIntentErrorMessages`) rather than falling through silently --
 * unlike deterministicChecks.ts's bare-candidate fallback (no verb at all),
 * which stays lenient/silent-on-miss, unchanged.
 */
export function matchNavigationParaphrase(input: ParseCommandInput): ParseCommandResult | null {
    const trimmed = input.command.trim()
    if (!trimmed) {
        return null
    }
    const verbMatch = new RegExp(`^(${MOVEMENT_VERBS.join('|')})\\s+(.+)$`, 'i').exec(trimmed)
    if (!verbMatch) {
        return null
    }
    const rawCandidate = verbMatch[2]
    if (!normalizeCommandToken(rawCandidate)) {
        return null
    }
    const resolved = resolveExitLabelToTargetId(input, rawCandidate)
    if (resolved.type === 'Resolved') {
        return {
            type: 'Navigation',
            targetId: resolved.targetId,
            exitName: resolved.exitName,
            confidence: 1,
        }
    }
    if (resolved.type === 'NoMatch') {
        return { type: 'Error', errorMessage: navigationIntentErrorMessages.noMatch }
    }
    if (resolved.type === 'AmbiguousMatch') {
        return { type: 'Error', errorMessage: navigationIntentErrorMessages.ambiguousMatch }
    }
    return null
}
