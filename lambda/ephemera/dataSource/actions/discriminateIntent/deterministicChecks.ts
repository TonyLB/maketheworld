import type {
    ParseCommandInput,
    ParseCommandObjectManipulationIntentResult,
    ParseCommandResult,
} from '../baseClasses'
import { COYOTE_ENGINE_TEST_FIXTURES } from '../../coyoteGame/generators/testHarness/coyoteEngineTestFixtures'
import { ACME_ORDER_AFFINITIES_HARNESS_FIXTURES } from '../acmeOrderAffinitiesHarnessPhrases'
import { OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES } from '../objectManipulationParseHarnessFixtures'
import { isCoyoteAffinitiesTestSlashCommand } from './coyoteAffinitiesTestSlashCommand'
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
import { isObjectManipulationParseTestSlashCommand } from './objectManipulationParseTestSlashCommand'
import { parseCoyoteAffinitiesTestSlashTail } from './parseCoyoteAffinitiesTestSlash'
import { parseCoyoteEngineTestSlashTail } from './parseCoyoteEngineTestSlash'
import { parseObjectManipulationParseTestSlashTail } from './parseObjectManipulationParseTestSlash'
import { normalizeCommandToken, resolveExitLabelToTargetId } from './exitResolution'
import { tokenize } from '../deterministicTemplate/granuleTokens'
import { matchPattern, matchPatternFills, type PatternFill } from '../deterministicTemplate/patternTemplate'
import { containmentTemplate } from '../enrich/objectManipulation/plan/matchContainmentTemplate'
import { membershipTemplate } from '../enrich/objectManipulation/plan/matchMembershipTemplate'
import { PLAN_GRANULES } from '../enrich/objectManipulation/plan/planSkeleton'
import { exceedsQualifierCap } from '../enrich/objectManipulation/plan/qualifierPrepositions'
import { spanMatchForms } from '../enrich/objectManipulation/spanMatchForms'

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

/**
 * The membership pattern's routing gate: it claims `take` and `drop` always (not `take hold`), and
 * `get` when some fill's head is a room label, as given or with its article peeled.
 */
function claimsMembership(input: ParseCommandInput, fills: readonly PatternFill[]): boolean {
    const uncut = fills.find(({ captures: [, phrase] }) => phrase?.kind === 'objectPhrase' && phrase.links.length === 0)
    const [verb, phrase] = uncut?.captures ?? []
    if (verb?.kind !== 'templateText' || phrase?.kind !== 'objectPhrase') {
        return false
    }
    if (verb.option === 'take' && /^hold\b/i.test(phrase.text)) {
        return false
    }
    const labels = input.roomObjectLabels ?? []
    const isLabel = (span: string): boolean => spanMatchForms(span).some((form) => labels.includes(form))
    return verb.option !== 'get' || fills.some(({ captures: [, head] }) => head !== undefined && isLabel(head.text))
}

/**
 * The zero-Bedrock fast path: the command cut into tokens as Plan cuts it (`PLAN_GRANULES`), and
 * template patterns matched over them, each with its routing gate. The membership template's
 * pattern claims as `claimsMembership` says; the containment template's pattern claims every fit,
 * since a fast-path Abstain climbs to the LLM route. A claim hands the tokens up, and Plan reads
 * every template over them (`actions/AGENT.contract.md` "Qualifier"). A command over the guard cap
 * (`exceedsQualifierCap`) is never claimed.
 */
function maybeDeterministicManipulationIntent(
    input: ParseCommandInput
): ParseCommandObjectManipulationIntentResult | null {
    const tokens = tokenize(PLAN_GRANULES, input.command)
    if (exceedsQualifierCap(tokens)) {
        return null
    }
    const claimed = claimsMembership(input, matchPatternFills(membershipTemplate.pattern, tokens))
        || matchPattern(containmentTemplate.pattern, tokens).length > 0
    return claimed ? { type: 'ObjectManipulationIntent', tokens, confidence: 1 } : null
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
    if (isObjectManipulationParseTestSlashCommand(input.command)) {
        const trimmed = input.command.trim()
        const parsed = parseObjectManipulationParseTestSlashTail(trimmed, OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES.length)
        if (!parsed.ok) {
            return { type: 'Error', errorMessage: parsed.errorMessage }
        }
        return {
            type: 'ObjectManipulationParseTest',
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
