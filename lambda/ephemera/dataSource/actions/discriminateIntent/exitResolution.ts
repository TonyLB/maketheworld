import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { ParseCommandInput } from '../baseClasses'

export type ExitResolutionResult =
    | { type: 'Resolved'; targetId: EphemeraRoomId }
    | { type: 'NoExitContext' }
    | { type: 'NoMatch' }
    | { type: 'AmbiguousMatch' }

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
    return { type: 'Resolved', targetId: matchingTargets[0] }
}
