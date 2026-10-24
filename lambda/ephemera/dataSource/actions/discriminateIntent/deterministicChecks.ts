import type {
    ParseCommandInput,
    ParseCommandObjectMembershipIntentResult,
    ParseCommandResult,
} from '../baseClasses'
import { normalizeExitName } from '../roomExitTargetsForCharacter'
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
import { peelLeadingArticleWhenTail } from './peelLeadingArticleWhenTail'
import type { ParseTokenDraft } from '../enrich/objectManipulation/parse/parseToken'
import type { PatternElement } from '../deterministicTemplate/deterministicTemplate'
import { matchPatternAgainstString, type ObjectPhraseLink } from '../deterministicTemplate/patternTemplate'
import { MEMBERSHIP_VERB_ELEMENT } from '../enrich/objectManipulation/plan/matchMembershipTemplate'
import { QUALIFIER_OBJECT_PHRASE_ELEMENT } from '../enrich/objectManipulation/plan/qualifierPrepositions'

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

type FastPathFill = { verb: string; option: string; rawHead: string; head: string; links: ObjectPhraseLink[] }

/** How many words a fill's prepositions hold: among fills with as many cuts, the longest phrases win. */
const prepositionWordCount = ({ links }: FastPathFill): number => (
    links.reduce((count, { text }) => count + text.split(' ').length, 0)
)

/**
 * The zero-Bedrock take/get/drop fast path: the membership verbs and an object phrase matched
 * against the command text (every set of cuts at the closed-set prepositions), and a claim policy
 * that keeps one fill. It claims `take` and `drop` always (not `take hold`), and `get` when the kept
 * fill's head is a room label. A tail that is a room label as a whole stays one span (a name like
 * "man in the moon"); otherwise the fill with the most cuts is kept, longest phrases first, which is
 * the flat skeleton Nova Micro returns. The policy never reads the verb to cut: which span a phrase
 * attaches to is decided by Plan, whose templates' object phrases read every way to attach it (each
 * fill a reading). Each span has its leading article peeled.
 */
function maybeDeterministicManipulationIntent(
    input: ParseCommandInput
): ParseCommandObjectMembershipIntentResult | null {
    const fills = matchPatternAgainstString(FAST_PATH_PATTERN, input.command).flatMap(({ captures: [verb, phrase] }): FastPathFill[] => (
        verb?.kind === 'templateText' && phrase?.kind === 'objectPhrase'
            ? [{
                verb: verb.text,
                option: verb.option,
                rawHead: phrase.text,
                head: peelLeadingArticleWhenTail(phrase.text),
                links: phrase.links.map((link) => ({ ...link, span: peelLeadingArticleWhenTail(link.span) })),
            }]
            : []
    ))
    const uncut = fills.find(({ links }) => links.length === 0)
    if (!uncut) {
        return null
    }

    if (uncut.option === 'take' && /^hold\b/i.test(uncut.rawHead)) {
        return null
    }

    const labels = input.roomObjectLabels ?? []
    const isLabel = (span: string): boolean => {
        const normalizedSpan = normalizeExitName(span)
        return normalizedSpan.length > 0 && labels.includes(normalizedSpan)
    }
    const kept = isLabel(uncut.head)
        ? uncut
        : fills.reduce((best, fill) => (
            fill.links.length > best.links.length
            || (fill.links.length === best.links.length && prepositionWordCount(fill) > prepositionWordCount(best))
                ? fill
                : best
        ))

    if (kept.option === 'get' && !isLabel(kept.head)) {
        return null
    }

    return {
        type: 'ObjectMembershipIntent',
        skeleton: [
            { type: 'text', text: kept.verb },
            { type: 'objectSpan', span: kept.head },
            ...kept.links.flatMap(({ text, span }): ParseTokenDraft[] => [
                { type: 'text', text },
                { type: 'objectSpan', span },
            ]),
        ],
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
