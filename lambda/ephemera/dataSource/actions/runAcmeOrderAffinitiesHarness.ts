import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'
import type { MessageBus } from '../../messageBus/baseClasses'
import { COYOTE_RENDER_LINE_BREAK } from '../coyoteGame/coyoteRenderTree'
import { ACME_ORDER_AFFINITIES_HARNESS_PHRASES } from './acmeOrderAffinitiesHarnessPhrases'
import type { ParseCommandResult } from './baseClasses'
import { parseCommand } from './parseCommand'

export type RunAcmeOrderAffinitiesHarnessDeps = {
    characterId: EphemeraCharacterId
    messageBus: Pick<MessageBus, 'send'>
    phrases?: readonly string[]
    /** Override for tests; defaults to [`parseCommand`]. */
    parseCommandImpl?: typeof parseCommand
    now?: () => number
}

function formatParseResultJson(result: ParseCommandResult): string {
    return JSON.stringify(result, null, 2)
}

/**
 * Runs **`parseCommand`** once per canonical phrase as **`order &lt;phrase&gt;`**, then publishes **one** OOC message with all results for manual review.
 */
export async function runAcmeOrderAffinitiesHarness(deps: RunAcmeOrderAffinitiesHarnessDeps): Promise<void> {
    const phrases = deps.phrases ?? ACME_ORDER_AFFINITIES_HARNESS_PHRASES
    const runParse = deps.parseCommandImpl ?? parseCommand
    const now = deps.now ?? (() => Date.now())

    const tree: RenderTree = [
        'Acme affinities harness (parseCommand Step A + Step B per line)',
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
            result = await runParse({ command }, {})
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
