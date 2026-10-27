/**
 * The machine reasons a navigation is refused with, by the dry run (`attemptCandidates.ts`
 * `navigationFailure`): the exit it names leads nowhere from here, or to more than one room.
 * `actions/index.ts` maps each to its player copy.
 */
export const navigationIntentErrorMessages = {
    noMatch: 'NavigationIntent resolution failed: no such exit',
    ambiguousMatch: 'NavigationIntent resolution failed: ambiguous exit',
} as const

/** An exit name as a command or the exits list spells it: trimmed, lowercased, single-spaced. */
export function normalizeCommandToken(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, ' ')
}
