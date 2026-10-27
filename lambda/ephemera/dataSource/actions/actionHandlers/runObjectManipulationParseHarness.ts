import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import type {
    ObjectManipulationParseHarnessFixture,
    ObjectManipulationParseHarnessInvocation,
} from '../baseClasses'
import { deterministicIntentChecks } from '../discriminateIntent/deterministicChecks'
import { tokenize, type GranuleToken } from '../deterministicTemplate/granuleTokens'
import { skeletonText } from '../deterministicTemplate/patternTemplate'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { runParseStage } from '../enrich/objectManipulation/parse/runParseStage'
import { PLAN_GRANULES, readPlanTemplates, type PlanTemplateRead } from '../enrich/objectManipulation/plan/planSkeleton'
import { OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES } from '../objectManipulationParseHarnessFixtures'

export type RunObjectManipulationParseHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'publish'>
    harnessInvocation?: ObjectManipulationParseHarnessInvocation
    fixtures?: readonly ObjectManipulationParseHarnessFixture[]
    runParseStageImpl?: typeof runParseStage
    now?: () => number
}

type HarnessCase = { label: string; command: string }

function selectCases(
    fixtures: readonly ObjectManipulationParseHarnessFixture[],
    invocation: ObjectManipulationParseHarnessInvocation | undefined
): HarnessCase[] {
    const fromFixture = (fixture: ObjectManipulationParseHarnessFixture, index: number): HarnessCase => ({
        label: `[${index + 1}] ${fixture.corpusCase}`,
        command: fixture.command,
    })
    if (invocation === undefined) {
        return fixtures.map(fromFixture)
    }
    if ('command' in invocation) {
        return [{ label: '[free text]', command: invocation.command }]
    }
    const fixture = fixtures[invocation.fixtureIndex1Based - 1]
    return fixture ? [fromFixture(fixture, invocation.fixtureIndex1Based - 1)] : []
}

/** `text "get" | span "cup on the table"`: the skeleton on one line, spans and text runs in order. */
export function formatSkeleton(skeleton: ParseSkeleton): string {
    return skeleton
        .map(token => (token.type === 'objectSpan' ? `span "${token.span}"` : `text "${token.text}"`))
        .join(' | ')
}

/** `put | the bag | in | the box`: the tokens on one line, each as typed. */
export function formatTokens(tokens: readonly GranuleToken[]): string {
    return tokens.map((token) => (token.kind === 'punctuation' ? token.text : token.words.join(' '))).join(' | ')
}

/**
 * Runs each selected command down the route production takes to its tokens, then Plan, and
 * publishes **one** OOC message with the results for manual review: the route, the tokens, and each
 * segmentation Plan's readings make with every attempt read from it. A command the
 * take/get/drop/put/place fast path claims (`deterministicIntentChecks`) is read from its own
 * tokens with no Bedrock call; any other runs the live Parse stage, whose skeleton is shown and
 * whose words are re-tokenized. No world is read; candidates and the dry run are out of its reach.
 */
export async function runObjectManipulationParseHarness(deps: RunObjectManipulationParseHarnessDeps): Promise<void> {
    const runParse = deps.runParseStageImpl ?? runParseStage
    const now = deps.now ?? (() => Date.now())
    const cases = selectCases(deps.fixtures ?? OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES, deps.harnessInvocation)

    const tree: RenderTree = ['Object manipulation Parse harness (route + Plan, no world)', COYOTE_RENDER_LINE_BREAK]
    if (cases.length === 0) {
        tree.push('(no commands)')
    }
    for (const [index, { label, command }] of cases.entries()) {
        tree.push(`--- ${index + 1}/${cases.length} ${label}: ${command} ---`, COYOTE_RENDER_LINE_BREAK)
        const fastPath = deterministicIntentChecks({ command })
        let tokens: GranuleToken[]
        if (fastPath?.type === 'ObjectManipulationIntent') {
            tokens = fastPath.tokens
            tree.push('Route: fast path', COYOTE_RENDER_LINE_BREAK)
        }
        else {
            tree.push('Route: LLM (Parse)', COYOTE_RENDER_LINE_BREAK)
            const startMs = now()
            const parsed = await runParse({ command })
            tree.push(`elapsedMs: ${now() - startMs}`, COYOTE_RENDER_LINE_BREAK)
            if (parsed.type === 'error') {
                tree.push(`Parse error: ${parsed.errorMessage}`, COYOTE_RENDER_LINE_BREAK)
                continue
            }
            tree.push(`Parse: ${formatSkeleton(parsed.tokens)}`, COYOTE_RENDER_LINE_BREAK)
            // Plan reads Parse's words, cut into tokens as the command's would be.
            tokens = tokenize(PLAN_GRANULES, skeletonText(parsed.tokens))
        }
        tree.push(`Tokens: ${formatTokens(tokens)}`, COYOTE_RENDER_LINE_BREAK)
        const reads = readPlanTemplates(tokens, command)
        tree.push(`Readings: ${reads.length}`, COYOTE_RENDER_LINE_BREAK)
        // Each segmentation once, with every template's attempt read from it.
        const bySegmentation = reads.reduce<Map<string, PlanTemplateRead[]>>((groups, read) => (
            groups.set(read.segmentationKey, [...(groups.get(read.segmentationKey) ?? []), read])
        ), new Map())
        for (const group of bySegmentation.values()) {
            tree.push(`Skeleton: ${formatSkeleton(group[0].segmentation)}`, COYOTE_RENDER_LINE_BREAK)
            for (const { template, attempt } of group) {
                const { referents, actions } = attempt.toJSON()
                tree.push(`Attempt (${template}): ${JSON.stringify({ referents, actions })}`, COYOTE_RENDER_LINE_BREAK)
            }
        }
    }

    deps.messageBus.publish({
        type: 'PublishMessage',
        targets: [deps.characterId],
        displayProtocol: 'WorldOOCMessage',
        message: tree,
    })
}
