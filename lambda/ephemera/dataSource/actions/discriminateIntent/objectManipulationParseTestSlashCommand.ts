/**
 * Canonical Parse harness slash; match is case-sensitive ASCII.
 *
 * Operator usage:
 * - `/test parse` runs every fixture.
 * - `/test parse <n>` runs fixture `<n>` (1-based), validated in slash-tail parsing.
 * - `/test parse "<command>"` runs any command text.
 */
export const OBJECT_MANIPULATION_PARSE_TEST_SLASH_PREFIX = '/test parse'

/**
 * True when **`command`** is **`/test parse`** optionally followed by whitespace and more text.
 * Leading/trailing space on the whole line is ignored. **`/test parsefoo`** does not match.
 */
export function isObjectManipulationParseTestSlashCommand(command: string): boolean {
    const s = command.trim()
    const head = OBJECT_MANIPULATION_PARSE_TEST_SLASH_PREFIX
    if (!s.startsWith(head)) {
        return false
    }
    if (s.length === head.length) {
        return true
    }
    return /\s/.test(s[head.length]!)
}
