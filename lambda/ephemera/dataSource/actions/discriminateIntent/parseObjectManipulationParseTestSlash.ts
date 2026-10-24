import type { ObjectManipulationParseHarnessInvocation } from '../baseClasses'
import { OBJECT_MANIPULATION_PARSE_TEST_SLASH_PREFIX } from './objectManipulationParseTestSlashCommand'

const PREFIX_LEN = OBJECT_MANIPULATION_PARSE_TEST_SLASH_PREFIX.length

function invalidTailMessage(fixtureCount: number, detail: string): string {
    return `Parse test (/test parse): ${detail} Use no argument for every fixture, a fixture index from 1 to ${fixtureCount}, or a quoted command ("get the cup on the table").`
}

export type ParseObjectManipulationParseTestSlashResult =
    | { ok: true; harnessInvocation?: ObjectManipulationParseHarnessInvocation }
    | { ok: false; errorMessage: string }

/**
 * Parses the `/test parse` tail. Call only when {@link isObjectManipulationParseTestSlashCommand} is true.
 *
 * - `/test parse` => every fixture.
 * - `/test parse <n>` => fixture `<n>` (1-based).
 * - `/test parse "<command>"` => that command (straight or curly double quotes; non-empty).
 * - Anything else => deterministic `Error` parse result with usage guidance.
 */
export function parseObjectManipulationParseTestSlashTail(
    trimmedCommand: string,
    fixtureCount: number
): ParseObjectManipulationParseTestSlashResult {
    const tail = trimmedCommand.slice(PREFIX_LEN).trim()
    if (tail.length === 0) {
        return { ok: true }
    }
    const quoted = /^["“]([\s\S]*)["”]$/.exec(tail)
    if (quoted) {
        const command = quoted[1]!.trim()
        if (!command) {
            return { ok: false, errorMessage: invalidTailMessage(fixtureCount, 'The quoted command is empty.') }
        }
        return { ok: true, harnessInvocation: { command } }
    }
    if (!/^[1-9]\d*$/.test(tail)) {
        return { ok: false, errorMessage: invalidTailMessage(fixtureCount, `Unrecognized argument "${tail}".`) }
    }
    const fixtureIndex1Based = Number.parseInt(tail, 10)
    if (fixtureIndex1Based > fixtureCount) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(fixtureCount, `Fixture index ${fixtureIndex1Based} is out of range.`),
        }
    }
    return { ok: true, harnessInvocation: { fixtureIndex1Based } }
}
