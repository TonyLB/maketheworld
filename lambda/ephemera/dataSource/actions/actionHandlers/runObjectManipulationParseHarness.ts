import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import type {
    ObjectManipulationParseHarnessFixture,
    ObjectManipulationParseHarnessInvocation,
} from '../baseClasses'
import { deterministicIntentChecks } from '../discriminateIntent/deterministicChecks'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { runParseStage } from '../enrich/objectManipulation/parse/runParseStage'
import { stampStableRefKeys } from '../enrich/objectManipulation/parse/stampStableRefKeys'
import { matchPlanTemplates } from '../enrich/objectManipulation/plan/planSkeleton'
import { OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES } from '../objectManipulationParseHarnessFixtures'
import { getRoomObjectLabelsForCharacter } from '../roomObjectLabelsForCharacter'

export type RunObjectManipulationParseHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'publish'>
    harnessInvocation?: ObjectManipulationParseHarnessInvocation
    fixtures?: readonly ObjectManipulationParseHarnessFixture[]
    runParseStageImpl?: typeof runParseStage
    /** The actor's room labels, which decide whether the fast path claims a `get`. Read once per run. */
    getRoomObjectLabelsImpl?: (characterId: EphemeraCharacterId) => Promise<string[]>
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

/**
 * Runs each selected command down the route production takes to a skeleton, then Plan, and
 * publishes **one** OOC message with the results for manual review: the route, the skeleton, each
 * template's match, and each attempt Plan emits. A command the take/get/drop fast path claims
 * (`deterministicIntentChecks`, with the actor's room labels) shows the fast path's skeleton with
 * no Bedrock call; any other runs the live Parse stage. Beyond the labels no world is read;
 * candidates and the dry run are out of its reach.
 */
export async function runObjectManipulationParseHarness(deps: RunObjectManipulationParseHarnessDeps): Promise<void> {
    const runParse = deps.runParseStageImpl ?? runParseStage
    const now = deps.now ?? (() => Date.now())
    const cases = selectCases(deps.fixtures ?? OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES, deps.harnessInvocation)
    const roomObjectLabels = await (deps.getRoomObjectLabelsImpl ?? getRoomObjectLabelsForCharacter)(deps.characterId)

    const tree: RenderTree = ['Object manipulation Parse harness (route + Plan, no world)', COYOTE_RENDER_LINE_BREAK]
    if (cases.length === 0) {
        tree.push('(no commands)')
    }
    for (const [index, { label, command }] of cases.entries()) {
        tree.push(`--- ${index + 1}/${cases.length} ${label}: ${command} ---`, COYOTE_RENDER_LINE_BREAK)
        const fastPath = deterministicIntentChecks({ command, roomObjectLabels })
        let skeleton: ParseSkeleton
        if (fastPath?.type === 'ObjectMembershipIntent') {
            skeleton = stampStableRefKeys(fastPath.skeleton)
            tree.push('Route: fast path', COYOTE_RENDER_LINE_BREAK, `Skeleton: ${formatSkeleton(skeleton)}`, COYOTE_RENDER_LINE_BREAK)
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
            skeleton = parsed.tokens
            tree.push(`Parse: ${formatSkeleton(skeleton)}`, COYOTE_RENDER_LINE_BREAK)
        }
        const matches = matchPlanTemplates(skeleton, command)
        tree.push(
            `Templates: ${matches.map(({ template, attempt }) => `${template} ${attempt ? 'matched' : 'noMatch'}`).join(', ')}`,
            COYOTE_RENDER_LINE_BREAK
        )
        for (const { template, attempt } of matches) {
            if (attempt) {
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
