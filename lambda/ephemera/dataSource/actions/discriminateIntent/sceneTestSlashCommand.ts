import { sceneFormats, type SceneFormat } from '../sceneProse'

/**
 * Canonical scene harness slash; match is case-sensitive ASCII.
 *
 * Operator usage: `/test scene` renders the scene of your own actor's cache in format D with its handle table;
 * `/test scene <format>` renders it in that format (any of `sceneFormats`, case-insensitive).
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

export type ParseSceneTestSlashResult = { ok: true; format?: SceneFormat } | { ok: false; errorMessage: string }

/**
 * Parses the `/test scene` tail. Call only when {@link isSceneTestSlashCommand} is true. No tail: the default format. A
 * format name, in any case: that format. Anything else is refused with usage guidance.
 */
export function parseSceneTestSlashTail(trimmedCommand: string): ParseSceneTestSlashResult {
    const tail = trimmedCommand.slice(SCENE_TEST_SLASH_PREFIX.length).trim()
    if (tail.length === 0) {
        return { ok: true }
    }
    const format = sceneFormats.find((name) => name.toLowerCase() === tail.toLowerCase())
    return format !== undefined
        ? { ok: true, format }
        : { ok: false, errorMessage: `Scene test (/test scene): unrecognized format "${tail}". Use no argument for format D, or one of: ${sceneFormats.join(', ')}.` }
}
