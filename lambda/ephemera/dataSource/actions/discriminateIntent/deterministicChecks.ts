import type {
    ParseCommandInput,
    ParseCommandObjectMembershipIntentResult,
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
import type { ParseTokenDraft } from '../enrich/objectManipulation/parse/parseToken'
import type { PatternElement } from '../deterministicTemplate/deterministicTemplate'
import { matchPatternAgainstString, type ObjectPhraseLink } from '../deterministicTemplate/patternTemplate'
import { MEMBERSHIP_VERB_ELEMENT } from '../enrich/objectManipulation/plan/matchMembershipTemplate'
import { QUALIFIER_OBJECT_PHRASE_ELEMENT } from '../enrich/objectManipulation/plan/qualifierPrepositions'
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

/** The fast path's one pattern: a membership verb, then an object phrase cut at the closed-set prepositions. */
const FAST_PATH_PATTERN: readonly PatternElement[] = [MEMBERSHIP_VERB_ELEMENT, QUALIFIER_OBJECT_PHRASE_ELEMENT]

type FastPathFill = { verb: string; option: string; head: string; links: ObjectPhraseLink[] }

/**
 * The zero-Bedrock take/get/drop fast path: the membership verbs and an object phrase matched
 * against the command text, every set of cuts at the closed-set prepositions a fill. Every fill goes
 * to Plan as its own skeleton (PA-2 (b)): a segmentation is a reading, like an attachment, and
 * Identify's exact match, the dry run and selection choose among them. What remains here is the
 * routing gate: it claims `take` and `drop` always (not `take hold`), and `get` when some fill's head
 * is a room label, as given or with its article peeled. Spans pass through as typed.
 */
function maybeDeterministicManipulationIntent(
    input: ParseCommandInput
): ParseCommandObjectMembershipIntentResult | null {
    const fills = matchPatternAgainstString(FAST_PATH_PATTERN, input.command).flatMap(({ captures: [verb, phrase] }): FastPathFill[] => (
        verb?.kind === 'templateText' && phrase?.kind === 'objectPhrase'
            ? [{
                verb: verb.text,
                option: verb.option,
                head: phrase.text,
                links: phrase.links,
            }]
            : []
    ))
    const uncut = fills.find(({ links }) => links.length === 0)
    if (!uncut) {
        return null
    }

    if (uncut.option === 'take' && /^hold\b/i.test(uncut.head)) {
        return null
    }

    const labels = input.roomObjectLabels ?? []
    const isLabel = (span: string): boolean => spanMatchForms(span).some((form) => labels.includes(form))
    if (uncut.option === 'get' && !fills.some(({ head }) => isLabel(head))) {
        return null
    }

    return {
        type: 'ObjectMembershipIntent',
        skeletons: fills.map(({ verb, head, links }): ParseTokenDraft[] => [
            { type: 'text', text: verb },
            { type: 'objectSpan', span: head },
            ...links.flatMap(({ text, span }): ParseTokenDraft[] => [
                { type: 'text', text },
                { type: 'objectSpan', span },
            ]),
        ]),
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
