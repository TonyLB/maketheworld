/** Canonical harness slash display string (case-insensitive when matching). */
export const COYOTE_ENGINE_TEST_SLASH_PREFIX = '/test generation'

/** Byte length of **`/test generation`**; use for slice-based tail extraction after case-insensitive prefix match. */
export const COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH = COYOTE_ENGINE_TEST_SLASH_PREFIX.length

const PREFIX_LOWER = COYOTE_ENGINE_TEST_SLASH_PREFIX.toLowerCase()

/**
 * True when **`command`** is **`/test generation`** (case-insensitive), optionally followed by whitespace and more text.
 * Leading/trailing space on the whole line is ignored.**`/test generations`** and **`/test generationfoo`** do not match.
 */
export function isCoyoteEngineTestSlashCommand(command: string): boolean {
    const s = command.trim()
    if (s.length < COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH) {
        return false
    }
    if (s.slice(0, COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH).toLowerCase() !== PREFIX_LOWER) {
        return false
    }
    if (s.length === COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH) {
        return true
    }
    return /\s/.test(s[COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH]!)
}
