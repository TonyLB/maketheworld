import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ParseCommandInput } from '../baseClasses'

export type ExitResolutionResult =
    | { type: 'Resolved'; targetId: EphemeraRoomId; exitName: string }
    | { type: 'NoExitContext' }
    | { type: 'NoMatch' }
    | { type: 'AmbiguousMatch' }

/**
 * **Orphaned (iteration 7, Sub-iteration 1, 2026-07-20): nothing constructs an `Error` with
 * these messages today.** They were produced by the post-classify NavigationIntent resolution
 * block (deleted from `discriminateIntent/index.ts` when classify narrowed to 5 outcomes), which
 * mapped `resolveExitLabelToTargetId`'s three failure arms to these specific player-facing copy
 * keys. `deterministicChecks.ts`'s `maybeDeterministicNavigationResult` still calls
 * `resolveExitLabelToTargetId` and still sees these three failure arms, but discards them (falls
 * through to classify -> now `Command` -> `Unimplemented`) rather than surfacing a specific
 * Error. `index.ts`'s `parseErrorMessageForPlayer` still has matching (currently unreachable)
 * `case` branches. Reconnect in Sub-iteration 2, alongside NavigationIntent's real command-plan
 * dispatch entry --- see
 * `taskPlanning/lambda/ephemera/dataSource/actions/AGENT.classifyPlanGeneralization.planning.md`,
 * Sub-iteration 2's Recommended order.
 */
export const navigationIntentErrorMessages = {
    noExitContext: 'NavigationIntent resolution failed: no current room exit context',
    noMatch: 'NavigationIntent resolution failed: no such exit',
    ambiguousMatch: 'NavigationIntent resolution failed: ambiguous exit',
} as const

export function normalizeCommandToken(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveExitLabelToTargetId(
    input: ParseCommandInput,
    rawCandidate: string
): ExitResolutionResult {
    if (!input.roomExits || input.roomExits.length === 0) {
        return { type: 'NoExitContext' }
    }
    const normalizedCandidate = normalizeCommandToken(rawCandidate)
    if (!normalizedCandidate) {
        return { type: 'NoMatch' }
    }
    const matchingTargets = [
        ...new Set(input.roomExits
            .filter(({ normalizedName }) => normalizedName === normalizedCandidate)
            .map(({ targetId }) => targetId)),
    ]
    if (matchingTargets.length === 0) {
        return { type: 'NoMatch' }
    }
    if (matchingTargets.length > 1) {
        return { type: 'AmbiguousMatch' }
    }
    return { type: 'Resolved', targetId: matchingTargets[0], exitName: normalizedCandidate }
}
