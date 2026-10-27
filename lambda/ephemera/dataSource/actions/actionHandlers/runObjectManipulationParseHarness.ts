import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import type {
    ObjectManipulationParseHarnessFixture,
    ObjectManipulationParseHarnessInvocation,
} from '../baseClasses'
import { deterministicIntentChecks } from '../discriminateIntent/deterministicChecks'
import { isBareExitFill } from '../enrich/objectManipulation/plan/matchNavigationTemplate'
import type { GranuleToken } from '../deterministicTemplate/granuleTokens'
import type { ParseSkeleton } from '../enrich/objectManipulation/parse/parseToken'
import { planTokens, readPlanTemplates, type PlanTemplateRead } from '../enrich/objectManipulation/plan/planSkeleton'
import { OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES } from '../objectManipulationParseHarnessFixtures'

export type RunObjectManipulationParseHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'publish'>
    harnessInvocation?: ObjectManipulationParseHarnessInvocation
    fixtures?: readonly ObjectManipulationParseHarnessFixture[]
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
 * Runs each selected command's tokens through Plan, and publishes **one** OOC message with the results
 * for manual review: the route, the tokens, and each segmentation Plan's readings make with every
 * attempt read from it. Every command reads its own tokens with no Bedrock call. The route says
 * whether a template read the command (the fast path) or only the bare exit reading did (it fits
 * every command, and abstains unless the command names an exit, which no world here says), so the
 * command climbs to classify. No world is read; candidates and the dry run are out of its reach.
 */
export async function runObjectManipulationParseHarness(deps: RunObjectManipulationParseHarnessDeps): Promise<void> {
    const cases = selectCases(deps.fixtures ?? OBJECT_MANIPULATION_PARSE_HARNESS_FIXTURES, deps.harnessInvocation)

    const tree: RenderTree = ['Object manipulation Parse harness (route + Plan, no world)', COYOTE_RENDER_LINE_BREAK]
    if (cases.length === 0) {
        tree.push('(no commands)')
    }
    for (const [index, { label, command }] of cases.entries()) {
        tree.push(`--- ${index + 1}/${cases.length} ${label}: ${command} ---`, COYOTE_RENDER_LINE_BREAK)
        const fastPath = deterministicIntentChecks({ command })
        if (fastPath?.type !== 'ObjectManipulationIntent') {
            tree.push(`Route: fast path (${fastPath?.type ?? 'no tokens'})`, COYOTE_RENDER_LINE_BREAK)
            continue
        }
        const { tokens } = fastPath
        const readByATemplate = planTokens(tokens, command).some((fill) => !isBareExitFill(fill))
        tree.push(readByATemplate ? 'Route: fast path' : 'Route: bare exit reading only (climbs to classify)', COYOTE_RENDER_LINE_BREAK)
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
