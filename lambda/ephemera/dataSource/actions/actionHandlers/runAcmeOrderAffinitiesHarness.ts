import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../../messageBus/baseClasses'
import { invokeBedrockAcmeOrderEnrich } from '../../../generateExample/invokeBedrockAcmeOrderEnrich'
import { COYOTE_RENDER_LINE_BREAK } from '../../coyoteGame/utilities/coyoteRenderTree'
import { ACME_ORDER_AFFINITIES_HARNESS_PHRASES } from '../acmeOrderAffinitiesHarnessPhrases'
import type { ParseCommandDeps, ParseCommandResult } from '../baseClasses'
import { enrichAcmeOrder } from '../enrich/acmeOrder'
import { parseCommand, parseCommandWithEnrichReasoning } from '../parseCommand'

export type RunAcmeOrderAffinitiesHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send'>
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
    now?: () => number
}

function formatParseResultJson(result: ParseCommandResult): string {
    return JSON.stringify(result, null, 2)
}

/**
 * Runs **`parseCommand`** once per canonical phrase as **`order &lt;phrase&gt;`**, then publishes **one** OOC message with all results for manual review.
 *
 * With **`enrichOnly`**: runs **`buildParseAcmeOrderEnrichPrompt`** + **`invokeBedrockAcmeOrderEnrich`** + **`finalizeAcmeOrderFromEnrich`** per phrase (no intent classification).
 */
export async function runAcmeOrderAffinitiesHarness(deps: RunAcmeOrderAffinitiesHarnessDeps): Promise<void> {
    const phrases = deps.phrases ?? ACME_ORDER_AFFINITIES_HARNESS_PHRASES
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich
    const now = deps.now ?? (() => Date.now())
    const enrichOnly = deps.enrichOnly ?? false

    const tree: RenderTree = [
        enrichOnly
            ? 'Acme affinities harness (Acme enrich only per phrase)'
            : 'Acme affinities harness (parseCommand discriminate intent + Acme enrich per line)',
        COYOTE_RENDER_LINE_BREAK,
    ]

    if (phrases.length === 0) {
        tree.push('(no phrases)')
        deps.messageBus.send({
            type: 'PublishMessage',
            targets: [deps.characterId],
            displayProtocol: 'WorldOOCMessage',
            message: tree,
        })
        return
    }

    for (let i = 0; i < phrases.length; i += 1) {
        const phrase = phrases[i]!.trim()
        const command = `order ${phrase}`
        const startMs = now()
        let result: ParseCommandResult
        let displayReasoning = ''
        const parseDeps: ParseCommandDeps = {}
        try {
            if (enrichOnly) {
                const enriched = await enrichAcmeOrder(
                    { command, occupiedStableKeys: [] },
                    1,
                    invokeEnrich
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
        tree.push(`--- ${i + 1}/${phrases.length} ${command} ---`)
        tree.push(COYOTE_RENDER_LINE_BREAK)
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
