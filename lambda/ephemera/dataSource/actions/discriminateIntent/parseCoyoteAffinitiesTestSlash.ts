import type { CoyoteAffinitiesHarnessInvocation } from '../baseClasses'
import { COYOTE_AFFINITIES_TEST_SLASH_PREFIX } from './coyoteAffinitiesTestSlashCommand'

const PREFIX_LEN = COYOTE_AFFINITIES_TEST_SLASH_PREFIX.length

/** Strict positive decimal integer string (no sign, no decimals). */
function parseFixtureIndexToken(token: string): number | undefined {
    if (!/^[1-9]\d*$/.test(token)) {
        return undefined
    }
    return Number.parseInt(token, 10)
}

function usageSuffix(fixtureCount: number): string {
    return `Fixture index must be an integer from 1 to ${fixtureCount}.`
}

function invalidTailMessage(fixtureCount: number, detail: string): string {
    return `Coyote affinities test (/test affinities): ${detail} ${usageSuffix(fixtureCount)}`
}

export type ParseCoyoteAffinitiesTestSlashResult =
    | { ok: true; harnessInvocation?: CoyoteAffinitiesHarnessInvocation }
    | { ok: false; errorMessage: string }

/**
 * Parses `/test affinities` tail into harness invocation per locked slash UX.
 * Call only when {@link isCoyoteAffinitiesTestSlashCommand} is true for the trimmed command.
 */
export function parseCoyoteAffinitiesTestSlashTail(
    trimmedCommand: string,
    fixtureCount: number
): ParseCoyoteAffinitiesTestSlashResult {
    const tail = trimmedCommand.slice(PREFIX_LEN).trim()
    if (tail.length === 0) {
        return { ok: true }
    }
    const tokens = tail.split(/\s+/).filter(Boolean)
    if (tokens.length > 1) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                'Too many arguments (expected at most one fixture index).'
            ),
        }
    }
    const idx = parseFixtureIndexToken(tokens[0]!)
    if (idx === undefined) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Unknown token "${tokens[0]}". Expected a fixture index.`
            ),
        }
    }
    if (!Number.isInteger(idx) || idx < 1 || idx > fixtureCount) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Fixture index must be an integer from 1 to ${fixtureCount} (received ${tokens[0]}).`
            ),
        }
    }
    return {
        ok: true,
        harnessInvocation: { mode: 'full', fixtureIndex1Based: idx },
    }
}
