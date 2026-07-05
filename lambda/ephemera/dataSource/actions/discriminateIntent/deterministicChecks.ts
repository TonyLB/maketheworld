import type {
    ParseCommandInput,
    ParseCommandObjectMembershipIntentResult,
    ParseCommandResult,
} from '../baseClasses'
import { normalizeExitName } from '../roomExitTargetsForCharacter'
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

/** After trim, case-insensitive home as the whole line. */
function isBareHomeCommand(trimmed: string): boolean {
    return /^home$/i.test(trimmed)
}

/** After trim, case-insensitive predict as the whole line (no p alias). */
function isBarePredictCommand(trimmed: string): boolean {
    return /^predict$/i.test(trimmed)
}

function stripLeadingArticle(rawSpan: string): string {
    return rawSpan.trim().replace(/^the\s+/i, '').trim()
}

function maybeDeterministicManipulationIntent(
    input: ParseCommandInput
): ParseCommandObjectMembershipIntentResult | null {
    const trimmed = input.command.trim()
    if (!trimmed) {
        return null
    }

    const acquireMatch = /^(take|get)\s+(.+)$/i.exec(trimmed)
    const releaseMatch = /^drop\s+(.+)$/i.exec(trimmed)
    const verbClass = acquireMatch ? 'acquire' as const : releaseMatch ? 'release' as const : undefined
    const rawTail = acquireMatch?.[2] ?? releaseMatch?.[1]
    if (!verbClass || !rawTail) {
        return null
    }

    const tail = rawTail.trim()
    if (!tail) {
        return null
    }

    if (acquireMatch?.[1].toLowerCase() === 'take' && /^hold\b/i.test(tail)) {
        return null
    }

    const rawObjectSpan = stripLeadingArticle(tail)
    if (!rawObjectSpan) {
        return null
    }

    if (acquireMatch?.[1].toLowerCase() === 'get') {
        const normalizedSpan = normalizeExitName(rawObjectSpan)
        const labels = input.roomObjectLabels ?? []
        if (!normalizedSpan || !labels.includes(normalizedSpan)) {
            return null
        }
    }

    return {
        type: 'ObjectMembershipIntent',
        rawObjectSpans: [rawObjectSpan],
        verbClass,
        confidence: 1,
    }
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
    return {
        type: 'Navigation',
        targetId: resolved.targetId,
        exitName: resolved.exitName,
        confidence: 1,
    }
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
    if (isBarePredictCommand(trimmedCommand)) {
        return { type: 'PredictHypothesis', confidence: 1 }
    }
    if (isBareLookCommand(trimmedCommand)) {
        return { type: 'LookRoom', confidence: 1 }
    }
    if (isBareHelpCommand(trimmedCommand)) {
        return { type: 'Help', confidence: 1 }
    }
    if (isBareHomeCommand(trimmedCommand)) {
        return { type: 'Home', confidence: 1 }
    }

    const manipulationIntent = maybeDeterministicManipulationIntent(input)
    if (manipulationIntent) {
        return manipulationIntent
    }

    return maybeDeterministicNavigationResult(input)
}
