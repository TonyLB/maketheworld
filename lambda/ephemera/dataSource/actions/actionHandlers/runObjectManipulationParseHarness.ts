import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import type {
    ObjectManipulationParseHarnessFixture,
    ObjectManipulationParseHarnessInvocation,
} from '../baseClasses'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { runParseStage } from '../enrich/objectManipulation/parse/runParseStage'
import { matchPlanTemplates } from '../enrich/objectManipulation/plan/planSkeleton'
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

/**
 * Runs Parse (the live Bedrock call) and then Plan on each selected command, and publishes **one**
 * OOC message with the results for manual review: the skeleton, each template's match, and each
 * attempt Plan emits. No world is read; candidates and the dry run are out of its reach.
 */
export async function runObjectManipulationParseHarness(deps: RunObjectManipulationParseHarnessDeps): Promise<void> {
    const runParse = deps.runParseStageImpl ?? runParseStage
    const now = deps.now ?? (() => Date.now())
    const cases = selectCases(deps.fixtures ?? OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES, deps.harnessInvocation)

    const tree: RenderTree = ['Object manipulation Parse harness (Parse + Plan, no world)', COYOTE_RENDER_LINE_BREAK]
    if (cases.length === 0) {
        tree.push('(no commands)')
    }
    for (const [index, { label, command }] of cases.entries()) {
        tree.push(`--- ${index + 1}/${cases.length} ${label}: ${command} ---`, COYOTE_RENDER_LINE_BREAK)
        const startMs = now()
        const parsed = await runParse({ command })
        tree.push(`elapsedMs: ${now() - startMs}`, COYOTE_RENDER_LINE_BREAK)
        if (parsed.type === 'error') {
            tree.push(`Parse error: ${parsed.errorMessage}`, COYOTE_RENDER_LINE_BREAK)
            continue
        }
        tree.push(`Parse: ${formatSkeleton(parsed.tokens)}`, COYOTE_RENDER_LINE_BREAK)
        const matches = matchPlanTemplates(parsed.tokens, command)
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
