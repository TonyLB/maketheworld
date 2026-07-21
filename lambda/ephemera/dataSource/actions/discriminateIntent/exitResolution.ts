import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ParseCommandInput } from '../baseClasses'

export type ExitResolutionResult =
    | { type: 'Resolved'; targetId: EphemeraRoomId; exitName: string }
    | { type: 'NoExitContext' }
    | { type: 'NoMatch' }
    | { type: 'AmbiguousMatch' }

/**
 * Player-facing copy for `resolveExitLabelToTargetId`'s failure arms. Surfaced by
 * `plan/matchNavigationParaphrase.ts` (iteration 7, Sub-iteration 2, 2026-07-20) when an
 * explicit movement verb (`head`/`walk`/`move`/`travel`/`enter`) makes "this was a
 * navigation attempt" unambiguous. `deterministicChecks.ts`'s
 * `maybeDeterministicNavigationResult` (bare `go <exit>` or a bare exit name with no
 * verb at all) stays lenient and discards these same failure arms instead of
 * surfacing an Error, since a verbless candidate is genuinely ambiguous.
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
