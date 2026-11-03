/**
 * Canonical scene harness slash; match is case-sensitive ASCII.
 *
 * Operator usage: `/test scene` renders the scene of your own actor's cache (format D) with its handle table. It takes no argument.
 */
export const SCENE_TEST_SLASH_PREFIX = '/test scene'

/**
 * True when **`command`** is **`/test scene`** optionally followed by whitespace and more text.
 * Leading/trailing space on the whole line is ignored. **`/test scenefoo`** does not match.
 */
export function isSceneTestSlashCommand(command: string): boolean {
    const s = command.trim()
    const head = SCENE_TEST_SLASH_PREFIX
    if (!s.startsWith(head)) {
        return false
    }
    if (s.length === head.length) {
        return true
    }
    return /\s/.test(s[head.length]!)
}

export type ParseSceneTestSlashResult = { ok: true } | { ok: false; errorMessage: string }

/** Parses the `/test scene` tail. Call only when {@link isSceneTestSlashCommand} is true. Any tail is refused with usage guidance. */
export function parseSceneTestSlashTail(trimmedCommand: string): ParseSceneTestSlashResult {
    const tail = trimmedCommand.slice(SCENE_TEST_SLASH_PREFIX.length).trim()
    return tail.length === 0
        ? { ok: true }
        : { ok: false, errorMessage: `Scene test (/test scene): unrecognized argument "${tail}". /test scene takes no argument.` }
}
