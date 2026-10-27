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
import { tokenize, type GranuleToken } from '../deterministicTemplate/granuleTokens'
import { matchIntentTemplate } from '../deterministicTemplate/intentTemplates'
import { matchPattern } from '../deterministicTemplate/patternTemplate'
import { containmentTemplate } from '../enrich/objectManipulation/plan/matchContainmentTemplate'
import { membershipTemplate } from '../enrich/objectManipulation/plan/matchMembershipTemplate'
import { COMMAND_GRANULES } from '../enrich/objectManipulation/plan/planSkeleton'
import { exceedsQualifierCap } from '../enrich/objectManipulation/plan/qualifierPrepositions'

/**
 * The zero-Bedrock object fast path: the command's tokens (`COMMAND_GRANULES`, as Plan cuts it),
 * claimed when the membership or the containment template's pattern fits it, with no gate: what
 * the world must make true is Identify's and the dry run's to judge, and a fast-path Abstain
 * climbs to the LLM route. A claim hands the tokens up, and Plan reads every template over them
 * (`actions/AGENT.contract.md` "Qualifier"). A command over the guard cap (`exceedsQualifierCap`)
 * is never claimed.
 */
function maybeDeterministicManipulationIntent(
    tokens: GranuleToken[]
): ParseCommandObjectManipulationIntentResult | null {
    if (exceedsQualifierCap(tokens)) {
        return null
    }
    const claimed = [membershipTemplate, containmentTemplate].some(({ pattern }) => matchPattern(pattern, tokens).length > 0)
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

    // The intent rows first: no object template reads a command of fixed words alone, so the order
    // decides nothing between readings; it puts `go home` ahead of the Navigation regex, as bare `home` was.
    const tokens = tokenize(COMMAND_GRANULES, input.command)
    const intent = matchIntentTemplate(tokens)
    if (intent) {
        return intent
    }

    const manipulationIntent = maybeDeterministicManipulationIntent(tokens)
    if (manipulationIntent) {
        return manipulationIntent
    }

    return maybeDeterministicNavigationResult(input)
}
