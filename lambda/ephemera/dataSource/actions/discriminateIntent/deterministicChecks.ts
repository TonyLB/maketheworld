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
import { splitQualifierTail } from './splitQualifierTail'
import type { ParseTokenDraft } from '../enrich/objectManipulation/parse/parseToken'

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
 * The zero-Bedrock take/get/drop fast path. It claims `take` and `drop` always (not `take hold`),
 * and `get` when its head piece is a room label. It emits the flat skeleton Nova Micro returns for
 * the same command: a tail that is a room label as a whole stays one span (a name like "man in the
 * moon"); otherwise the tail is split at each closed-set preposition (`splitQualifierTail`). The
 * split reads only the words, never the verb: which piece a phrase attaches to is grouping's to
 * decide (`plan/groupSkeleton.ts`), so a drop's tail or a chain is split here and refused there.
 * The split is a stopgap until templates are matched against the command text
 * (`AGENT.skeletonPatterns.planning.md`).
 */
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

    const rawObjectSpan = peelLeadingArticleWhenTail(tail)
    if (!rawObjectSpan) {
        return null
    }

    const labels = input.roomObjectLabels ?? []
    const isLabel = (span: string): boolean => {
        const normalizedSpan = normalizeExitName(span)
        return normalizedSpan.length > 0 && labels.includes(normalizedSpan)
    }
    const { head, links } = isLabel(rawObjectSpan)
        ? { head: rawObjectSpan, links: [] }
        : splitQualifierTail(rawObjectSpan)

    if (acquireMatch?.[1].toLowerCase() === 'get' && !isLabel(head)) {
        return null
    }

    const verb = trimmed.split(/\s+/)[0]!
    return {
        type: 'ObjectMembershipIntent',
        skeleton: [
            { type: 'text', text: verb },
            { type: 'objectSpan', span: head },
            ...links.flatMap(({ preposition, span }): ParseTokenDraft[] => [
                { type: 'text', text: preposition },
                { type: 'objectSpan', span },
            ]),
        ],
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
