/** Canonical harness slash; match is case-sensitive ASCII. */
export const COYOTE_ENGINE_TEST_SLASH_PREFIX = '/test generation'

/**
 * True when **`command`** is **`/test generation`** optionally followed by whitespace and more text.
 * Leading/trailing space on the whole line is ignored.**`/test generations`** and **`/test generationfoo`** do not match.
 */
export function isCoyoteEngineTestSlashCommand(command: string): boolean {
    const s = command.trim()
    const head = COYOTE_ENGINE_TEST_SLASH_PREFIX
    if (!s.startsWith(head)) {
        return false
    }
    if (s.length === head.length) {
        return true
    }
    return /\s/.test(s[head.length]!)
}
