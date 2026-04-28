import type { ParseCommandInput, ParseCommandResult } from '../baseClasses'
import { COYOTE_ENGINE_TEST_FIXTURES } from '../../coyoteGame/generators/testHarness/coyoteEngineTestFixtures'
import { ACME_ORDER_AFFINITIES_HARNESS_FIXTURES } from '../acmeOrderAffinitiesHarnessPhrases'
import { isCoyoteAffinitiesTestSlashCommand } from './coyoteAffinitiesTestSlashCommand'
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
import { parseCoyoteAffinitiesTestSlashTail } from './parseCoyoteAffinitiesTestSlash'
import { parseCoyoteEngineTestSlashTail } from './parseCoyoteEngineTestSlash'
import { normalizeCommandToken, resolveExitLabelToTargetId } from './exitResolution'

/** After trim, case-insensitive look or l as the whole line. */
function isBareLookCommand(trimmed: string): boolean {
    return /^(?:look|l)$/i.test(trimmed)
}

/** After trim, case-insensitive help as the whole line. */
function isBareHelpCommand(trimmed: string): boolean {
    return /^help$/i.test(trimmed)
}

function maybeDeterministicNavigationResult(input: ParseCommandInput): ParseCommandResult | null {
    const trimmed = input.command.trim()
    if (!trimmed) {
        return null
    }
    const goMatch = /^go\s+(.+)$/i.exec(trimmed)
    const rawCandidate = goMatch ? goMatch[1] : trimmed
    if (!normalizeCommandToken(rawCandidate)) {
        return null
    }
    const resolved = resolveExitLabelToTargetId(input, rawCandidate)
    if (resolved.type !== 'Resolved') {
        return null
    }
    return { type: 'Navigation', targetId: resolved.targetId, confidence: 1 }
}

export function deterministicIntentChecks(input: ParseCommandInput): ParseCommandResult | null {
    if (isCoyoteEngineTestSlashCommand(input.command)) {
        const trimmed = input.command.trim()
        const parsed = parseCoyoteEngineTestSlashTail(trimmed, COYOTE_ENGINE_TEST_FIXTURES.length)
        if (!parsed.ok) {
            return { type: 'Error', errorMessage: parsed.errorMessage }
        }
        return {
            type: 'CoyoteEngineTest',
            confidence: 1,
            ...(parsed.harnessInvocation !== undefined ? { harnessInvocation: parsed.harnessInvocation } : {}),
        }
    }
    if (isCoyoteAffinitiesTestSlashCommand(input.command)) {
        const trimmed = input.command.trim()
        const parsed = parseCoyoteAffinitiesTestSlashTail(trimmed, ACME_ORDER_AFFINITIES_HARNESS_FIXTURES.length)
        if (!parsed.ok) {
            return { type: 'Error', errorMessage: parsed.errorMessage }
        }
        return {
            type: 'CoyoteAffinitiesTest',
            confidence: 1,
            ...(parsed.harnessInvocation !== undefined ? { harnessInvocation: parsed.harnessInvocation } : {}),
        }
    }

    const trimmedCommand = input.command.trim()
    if (isBareLookCommand(trimmedCommand)) {
        return { type: 'LookRoom', confidence: 1 }
    }
    if (isBareHelpCommand(trimmedCommand)) {
        return { type: 'Help', confidence: 1 }
    }

    return maybeDeterministicNavigationResult(input)
}
