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
    return `Fixture index must be an integer from 1 to ${fixtureCount}, or add **verbose** for legacy Step 1.`
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
 *
 * Operator-facing grammar (tokens are order-independent except at most one index and at most one **verbose**):
 * - `/test affinities` => full fixture run, compact Acme enrich Step 1.
 * - `/test affinities <n>` => single fixture (1-based index), compact Step 1.
 * - `/test affinities verbose` => full run, verbose (legacy) Step 1 in the enrich prompt.
 * - `/test affinities <n> verbose` or `/test affinities verbose <n>` => one fixture, verbose Step 1.
 * - Any other tail shape => deterministic `Error` parse result with usage guidance.
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
    if (tokens.length > 2) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                'Too many arguments (expected at most a fixture index and optional "verbose").'
            ),
        }
    }

    let fixtureIndex1Based: number | undefined
    let includeVerbose = false
    for (const raw of tokens) {
        if (/^verbose$/i.test(raw)) {
            if (includeVerbose) {
                return {
                    ok: false,
                    errorMessage: invalidTailMessage(fixtureCount, 'Duplicate "verbose" token.'),
                }
            }
            includeVerbose = true
            continue
        }
        const idx = parseFixtureIndexToken(raw)
        if (idx === undefined) {
            return {
                ok: false,
                errorMessage: invalidTailMessage(
                    fixtureCount,
                    `Unknown token "${raw}". Expected a fixture index (1-${fixtureCount}) or "verbose".`
                ),
            }
        }
        if (fixtureIndex1Based !== undefined) {
            return {
                ok: false,
                errorMessage: invalidTailMessage(
                    fixtureCount,
                    'Too many fixture indices (expected at most one).'
                ),
            }
        }
        fixtureIndex1Based = idx
    }

    if (fixtureIndex1Based !== undefined) {
        if (!Number.isInteger(fixtureIndex1Based) || fixtureIndex1Based < 1 || fixtureIndex1Based > fixtureCount) {
            return {
                ok: false,
                errorMessage: invalidTailMessage(
                    fixtureCount,
                    `Fixture index must be an integer from 1 to ${fixtureCount} (received ${fixtureIndex1Based}).`
                ),
            }
        }
    }

    const harnessInvocation: CoyoteAffinitiesHarnessInvocation = {
        mode: 'full',
        ...(fixtureIndex1Based !== undefined ? { fixtureIndex1Based } : {}),
        ...(includeVerbose ? { verbose: true } : {}),
    }
    return { ok: true, harnessInvocation }
}
