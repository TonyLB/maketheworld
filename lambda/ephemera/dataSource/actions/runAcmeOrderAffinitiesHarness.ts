import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { AcmeOrderEnrichModelResponse } from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../messageBus/baseClasses'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import { COYOTE_RENDER_LINE_BREAK } from '../coyoteGame/coyoteRenderTree'
import { ACME_ORDER_AFFINITIES_HARNESS_PHRASES } from './acmeOrderAffinitiesHarnessPhrases'
import type { ParseCommandResult } from './baseClasses'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'
import { finalizeAcmeOrderFromStepB, interpretAcmeOrderEnrichBody } from './mergeAcmeOrderEnrich'
import { parseCommand } from './parseCommand'

export type RunAcmeOrderAffinitiesHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send'>
    phrases?: readonly string[]
    /** When true, only Step B (enrich) runs with the full command string; Step A is skipped. */
    stepBOnly?: boolean
    /** Override for tests; defaults to [`parseCommand`] when **`stepBOnly`** is false. */
    parseCommandImpl?: typeof parseCommand
    /** Override Bedrock enrich for tests when **`stepBOnly`** is true. */
    invokeBedrockAcmeOrderEnrichImpl?: typeof invokeBedrockAcmeOrderEnrich
    now?: () => number
}

function formatParseResultJson(result: ParseCommandResult): string {
    return JSON.stringify(result, null, 2)
}

/**
 * Runs **`parseCommand`** once per canonical phrase as **`order &lt;phrase&gt;`**, then publishes **one** OOC message with all results for manual review.
 *
 * With **`stepBOnly`**: runs **`buildParseAcmeOrderEnrichPrompt`** + **`invokeBedrockAcmeOrderEnrich`** + **`finalizeAcmeOrderFromStepB`** per phrase (no intent classification).
 */
export async function runAcmeOrderAffinitiesHarness(deps: RunAcmeOrderAffinitiesHarnessDeps): Promise<void> {
    const phrases = deps.phrases ?? ACME_ORDER_AFFINITIES_HARNESS_PHRASES
    const runParse = deps.parseCommandImpl ?? parseCommand
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich
    const now = deps.now ?? (() => Date.now())
    const stepBOnly = deps.stepBOnly ?? false

    const tree: RenderTree = [
        stepBOnly
            ? 'Acme affinities harness (Step B enrich only per phrase)'
            : 'Acme affinities harness (parseCommand Step A + Step B per line)',
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
        try {
            if (stepBOnly) {
                const parts = buildParseAcmeOrderEnrichPrompt(command)
                const enrichInvoke = await invokeEnrich(parts)
                let enrichFailed = !enrichInvoke.success
                let response: AcmeOrderEnrichModelResponse | null = null
                if (enrichInvoke.success) {
                    const parsed = interpretAcmeOrderEnrichBody(enrichInvoke.body, {
                        emptyFallbackName: command.trim() || 'order',
                    })
                    if (parsed.success) {
                        response = parsed.response
                    } else {
                        enrichFailed = true
                    }
                }
                result = finalizeAcmeOrderFromStepB(1, response, enrichFailed, command.trim() || 'order')
            }
            else {
                result = await runParse({ command }, {})
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
        tree.push(formatParseResultJson(result))
    }

    deps.messageBus.send({
        type: 'PublishMessage',
        targets: [deps.characterId],
        displayProtocol: 'WorldOOCMessage',
        message: tree,
    })
}
