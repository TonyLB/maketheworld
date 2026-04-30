import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { invokeBedrockAcmeOrderEnrich } from '../../../generateExample/invokeBedrockAcmeOrderEnrich'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import {
    ACME_ORDER_AFFINITIES_HARNESS_FIXTURES,
} from '../acmeOrderAffinitiesHarnessPhrases'
import type {
    AcmeOrderAffinitiesHarnessFixture,
    CoyoteAffinitiesHarnessInvocation,
    ParseCommandDeps,
    ParseCommandResult,
} from '../baseClasses'
import { enrichAcmeOrder } from '../enrich/acmeOrder'
import { parseCommand, parseCommandWithEnrichReasoning } from '../parseCommand'

export type RunAcmeOrderAffinitiesHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send'>
    fixtures?: readonly AcmeOrderAffinitiesHarnessFixture[]
    /** Legacy override path for tests; internally converted to lightweight fixtures. */
    phrases?: readonly string[]
    /** When true, only Acme order enrich runs with the full command string; intent discrimination is skipped. */
    enrichOnly?: boolean
    /**
     * Override for tests when **`enrichOnly`** is false. If unset, uses **`parseCommandWithEnrichReasoning`**
     * so chain-of-reason Markdown is available for display. **`parseCommandImpl`** is a legacy shortcut
     * that returns **`result`** only (no CoR in the published tree unless you also wire enrich reasoning).
     */
    parseCommandImpl?: typeof parseCommand
    /** Full override including **`enrichReasoningMarkdown`** for harness output when **`enrichOnly`** is false. */
    parseCommandWithEnrichReasoningImpl?: typeof parseCommandWithEnrichReasoning
    /** Override Bedrock enrich for tests when **`enrichOnly`** is true. */
    invokeBedrockAcmeOrderEnrichImpl?: typeof invokeBedrockAcmeOrderEnrich
    /** Optional slash-invocation payload (`/test affinities <n>`) for single-fixture runs. */
    harnessInvocation?: CoyoteAffinitiesHarnessInvocation
    /** Forwarded to **`enrichAcmeOrder`** when **`enrichOnly`** (tests avoid real Coyote cache object counts). */
    countCoyotePlacedObjectsAcrossRoomsDeps?: ParseCommandDeps['countCoyotePlacedObjectsAcrossRoomsDeps']
    now?: () => number
}

function formatParseResultJson(result: ParseCommandResult): string {
    return JSON.stringify(result, null, 2)
}

function selectHarnessFixtures(
    fixtures: readonly AcmeOrderAffinitiesHarnessFixture[],
    invocation: CoyoteAffinitiesHarnessInvocation | undefined
): readonly AcmeOrderAffinitiesHarnessFixture[] | { error: string } {
    const fixtureIndex1Based = invocation?.fixtureIndex1Based
    if (fixtureIndex1Based === undefined) {
        return fixtures
    }
    const max = fixtures.length
    if (!Number.isInteger(fixtureIndex1Based) || fixtureIndex1Based < 1 || fixtureIndex1Based > max) {
        return {
            error: `Coyote affinities test harness: fixture index must be an integer from 1 to ${max} (received ${fixtureIndex1Based}).`,
        }
    }
    return [fixtures[fixtureIndex1Based - 1]!]
}

function coercePhrasesToFixtures(phrases: readonly string[]): AcmeOrderAffinitiesHarnessFixture[] {
    return phrases.map((phrase, index) => ({
        id: `legacy-${index + 1}`,
        commandPhrase: phrase,
    }))
}

function appendFixtureMetadata(tree: RenderTree, fixture: AcmeOrderAffinitiesHarnessFixture): void {
    const sections: string[] = []
    if (fixture.bucket) {
        sections.push(`bucket: ${fixture.bucket}`)
    }
    if (fixture.tags && fixture.tags.length > 0) {
        sections.push(`tags: ${fixture.tags.join(', ')}`)
    }
    if (fixture.expectedLines && fixture.expectedLines.length > 0) {
        sections.push(`expectedLines: ${fixture.expectedLines.length}`)
    }
    if (fixture.likelyErrors && fixture.likelyErrors.length > 0) {
        sections.push(`likelyErrors: ${fixture.likelyErrors.length}`)
    }
    if (sections.length > 0) {
        tree.push('fixtureMetadata: ' + sections.join(' | '))
        tree.push(COYOTE_RENDER_LINE_BREAK)
    }
}

/**
 * Runs **`parseCommand`** once per canonical phrase as **`order &lt;phrase&gt;`**, then publishes **one** OOC message with all results for manual review.
 *
 * With **`enrichOnly`**: runs **`buildParseAcmeOrderEnrichPrompt`** + **`invokeBedrockAcmeOrderEnrich`** + **`finalizeAcmeOrderFromEnrich`** per phrase (no intent classification).
 */
export async function runAcmeOrderAffinitiesHarness(deps: RunAcmeOrderAffinitiesHarnessDeps): Promise<void> {
    const allFixtures = deps.fixtures
        ?? (deps.phrases ? coercePhrasesToFixtures(deps.phrases) : ACME_ORDER_AFFINITIES_HARNESS_FIXTURES)
    const selectedOrErr = selectHarnessFixtures(allFixtures, deps.harnessInvocation)
    if ('error' in selectedOrErr) {
        deps.messageBus.send({
            type: 'PublishMessage',
            targets: [deps.characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [selectedOrErr.error],
        })
        return
    }
    const fixtures = selectedOrErr
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich
    const now = deps.now ?? (() => Date.now())
    const enrichOnly = deps.enrichOnly ?? false

    const tree: RenderTree = [
        enrichOnly
            ? 'Acme affinities harness (Acme enrich only per phrase)'
            : 'Acme affinities harness (parseCommand discriminate intent + Acme enrich per line)',
        COYOTE_RENDER_LINE_BREAK,
    ]

    if (fixtures.length === 0) {
        tree.push('(no phrases)')
        deps.messageBus.send({
            type: 'PublishMessage',
            targets: [deps.characterId],
            displayProtocol: 'WorldOOCMessage',
            message: tree,
        })
        return
    }

    for (let i = 0; i < fixtures.length; i += 1) {
        const fixture = fixtures[i]!
        const phrase = fixture.commandPhrase.trim()
        const command = `order ${phrase}`
        const startMs = now()
        let result: ParseCommandResult
        let displayReasoning = ''
        const acmeEnrichVerbose = deps.harnessInvocation?.verbose === true
        const parseDeps: ParseCommandDeps = acmeEnrichVerbose
            ? { debugAcmeOrderEnrichRationale: true }
            : {}
        try {
            if (enrichOnly) {
                const enriched = await enrichAcmeOrder(
                    {
                        command,
                        occupiedStableKeys: [],
                    },
                    1,
                    invokeEnrich,
                    deps.countCoyotePlacedObjectsAcrossRoomsDeps
                )
                result = enriched.result
                displayReasoning = enriched.enrichReasoningMarkdown.trim()
            }
            else if (deps.parseCommandWithEnrichReasoningImpl) {
                const pair = await deps.parseCommandWithEnrichReasoningImpl({ command }, parseDeps)
                result = pair.result
                displayReasoning = pair.enrichReasoningMarkdown.trim()
            }
            else if (deps.parseCommandImpl) {
                result = await deps.parseCommandImpl({ command }, parseDeps)
            }
            else {
                const pair = await parseCommandWithEnrichReasoning({ command }, parseDeps)
                result = pair.result
                displayReasoning = pair.enrichReasoningMarkdown.trim()
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            result = { type: 'Error', errorMessage: message }
        }
        const elapsedMs = Math.max(0, now() - startMs)

        if (i > 0) {
            tree.push(COYOTE_RENDER_LINE_BREAK)
        }
        tree.push(`--- ${i + 1}/${fixtures.length} ${command} ---`)
        tree.push(COYOTE_RENDER_LINE_BREAK)
        appendFixtureMetadata(tree, fixture)
        tree.push(`elapsedMs: ${elapsedMs}`)
        tree.push(COYOTE_RENDER_LINE_BREAK)
        if (displayReasoning) {
            tree.push('Classify order type (markdown):')
            tree.push(COYOTE_RENDER_LINE_BREAK)
            tree.push(displayReasoning)
            tree.push(COYOTE_RENDER_LINE_BREAK)
        }
        tree.push(formatParseResultJson(result))
    }

    deps.messageBus.send({
        type: 'PublishMessage',
        targets: [deps.characterId],
        displayProtocol: 'WorldOOCMessage',
        message: tree,
    })
}
