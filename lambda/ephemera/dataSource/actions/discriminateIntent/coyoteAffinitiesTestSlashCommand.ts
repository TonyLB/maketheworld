/**
 * Canonical harness slash; match is case-sensitive ASCII.
 *
 * Operator usage:
 * - `/test affinities` runs the full fixture corpus.
 * - `/test affinities <n>` runs fixture `<n>` (1-based), validated in slash-tail parsing.
 */
export const COYOTE_AFFINITIES_TEST_SLASH_PREFIX = '/test affinities'

/**
 * True when **`command`** is **`/test affinities`** optionally followed by whitespace and more text.
 * Leading/trailing space on the whole line is ignored. **`/test affinitiesfoo`** does not match.
 */
export function isCoyoteAffinitiesTestSlashCommand(command: string): boolean {
    const s = command.trim()
    const head = COYOTE_AFFINITIES_TEST_SLASH_PREFIX
    if (!s.startsWith(head)) {
        return false
    }
    if (s.length === head.length) {
        return true
    }
    return /\s/.test(s[head.length]!)
}
