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
import { tokenize, type GranuleToken } from '../deterministicTemplate/granuleTokens'
import { matchIntentTemplate } from '../deterministicTemplate/intentTemplates'
import { matchPattern } from '../deterministicTemplate/patternTemplate'
import { COMMAND_GRANULES, PLAN_TEMPLATES } from '../enrich/objectManipulation/plan/planSkeleton'
import { exceedsQualifierCap } from '../enrich/objectManipulation/plan/qualifierPrepositions'

/**
 * The zero-Bedrock fast path for Plan's templates: the command's tokens (`COMMAND_GRANULES`, as Plan
 * cuts it), claimed when any of Plan's templates fits it, with no gate: what the world must make
 * true is Identify's and the dry run's to judge, and a fast-path Abstain climbs to the LLM route.
 * The bare exit template fits every command, so every command no intent row reads is claimed. A
 * claim hands the tokens up, and Plan reads every template over them (`actions/AGENT.contract.md`
 * "Qualifier"). A command over the guard cap (`exceedsQualifierCap`) is never claimed.
 */
function maybeDeterministicManipulationIntent(
    tokens: GranuleToken[]
): ParseCommandObjectManipulationIntentResult | null {
    if (exceedsQualifierCap(tokens)) {
        return null
    }
    const claimed = PLAN_TEMPLATES.some(({ pattern }) => matchPattern(pattern, tokens).length > 0)
    return claimed ? { type: 'ObjectManipulationIntent', tokens, confidence: 1 } : null
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

    // The intent rows first: they answer as results, not readings, so they run ahead of Plan's
    // templates; that puts `go home` ahead of a "home" exit, as bare `home` was.
    const tokens = tokenize(COMMAND_GRANULES, input.command)
    const intent = matchIntentTemplate(tokens)
    if (intent) {
        return intent
    }

    return maybeDeterministicManipulationIntent(tokens)
}
