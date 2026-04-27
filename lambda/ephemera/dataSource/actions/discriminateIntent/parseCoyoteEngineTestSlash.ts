import type { CoyoteEngineTestHarnessInvocation } from '../../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness'
import type { CoyoteHypothesisTestPhase } from '../../coyoteGame/generators/pipelines/hypothesis/generateHypothesis'
import { COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH } from './coyoteEngineTestSlashCommand'

const PREFIX_LEN = COYOTE_ENGINE_TEST_SLASH_PREFIX_LENGTH

const PHASE_ALIASES: CoyoteHypothesisTestPhase[] = ['clustering', 'planSelect', 'phasePlan']

function phaseFromToken(token: string): CoyoteHypothesisTestPhase | undefined {
    const lower = token.toLowerCase()
    for (const alias of PHASE_ALIASES) {
        if (alias.toLowerCase() === lower) {
            return alias
        }
    }
    return undefined
}

/** Strict positive decimal integer string (no sign, no decimals). */
function parseFixtureIndexToken(token: string): number | undefined {
    if (!/^[1-9]\d*$/.test(token)) {
        return undefined
    }
    return Number.parseInt(token, 10)
}

function usageSuffix(fixtureCount: number): string {
    return `Valid phase aliases (case-insensitive): ${PHASE_ALIASES.join(', ')}. Fixture index must be an integer from 1 to ${fixtureCount}.`
}

function invalidTailMessage(fixtureCount: number, detail: string): string {
    return `Coyote engine test (/test generation): ${detail} ${usageSuffix(fixtureCount)}`
}

export type ParseCoyoteEngineTestSlashResult =
    | { ok: true; harnessInvocation?: CoyoteEngineTestHarnessInvocation }
    | { ok: false; errorMessage: string }

/**
 * Parses `/test generation` tail into harness invocation per locked slash UX.
 * Call only when {@link isCoyoteEngineTestSlashCommand} is true for the trimmed command.
 */
export function parseCoyoteEngineTestSlashTail(
    trimmedCommand: string,
    fixtureCount: number
): ParseCoyoteEngineTestSlashResult {
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
                `Too many arguments (expected at most a phase alias and optional fixture index).`
            ),
        }
    }

    if (tokens.length === 1) {
        const phase = phaseFromToken(tokens[0]!)
        if (phase !== undefined) {
            return {
                ok: true,
                harnessInvocation: {
                    mode: 'partial',
                    testOnly: phase,
                    harnessRunKind: 'runUntil',
                },
            }
        }
        const idx = parseFixtureIndexToken(tokens[0]!)
        if (idx !== undefined) {
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
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Unknown token "${tokens[0]}". Expected a phase alias or a fixture index.`
            ),
        }
    }

    const idxFirst = parseFixtureIndexToken(tokens[0]!)
    if (idxFirst !== undefined) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Invalid token order: expected "<phaseAlias> <fixtureIndex>", not a fixture index first.`
            ),
        }
    }

    const phase = phaseFromToken(tokens[0]!)
    const idx = parseFixtureIndexToken(tokens[1]!)
    if (phase === undefined) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Unknown phase alias "${tokens[0]}".`
            ),
        }
    }
    if (idx === undefined) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Second token must be a fixture index from 1 to ${fixtureCount} (received "${tokens[1]}").`
            ),
        }
    }
    if (!Number.isInteger(idx) || idx < 1 || idx > fixtureCount) {
        return {
            ok: false,
            errorMessage: invalidTailMessage(
                fixtureCount,
                `Fixture index must be an integer from 1 to ${fixtureCount} (received ${tokens[1]}).`
            ),
        }
    }
    return {
        ok: true,
        harnessInvocation: {
            mode: 'partial',
            testOnly: phase,
            harnessRunKind: 'runUntil',
            fixtureIndex1Based: idx,
        },
    }
}
