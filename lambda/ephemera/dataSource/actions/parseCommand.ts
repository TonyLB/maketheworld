import {
    ACME_ORDER_ENRICH_MAX_LINES,
    type AcmeOrderEnrichModelResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import { invokeBedrockParseCommand } from '../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import { isParseCommandAcmeOrderResult } from './baseClasses'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'
import { buildParseCommandIntentClassificationPrompt } from './buildParseCommandIntentClassificationPrompt'
import { isCoyoteAffinitiesTestSlashCommand } from './coyoteAffinitiesTestSlashCommand'
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
import { interpretAcmeOrderEnrichBody, mergeAcmeOrderWithEnrich } from './mergeAcmeOrderEnrich'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; both without Bedrock.
 * Otherwise classifies via LLM (Step A), then runs Acme enrich (Step B) when intent is **AcmeOrder** with at least one valid line.
 */
export async function parseCommand(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandResult> {
    if (isCoyoteEngineTestSlashCommand(input.command)) {
        return { type: 'CoyoteEngineTest', confidence: 1 }
    }
    if (isCoyoteAffinitiesTestSlashCommand(input.command)) {
        return { type: 'CoyoteAffinitiesTest', confidence: 1 }
    }

    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich

    const prompt = buildParseCommandIntentClassificationPrompt(input.command)
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { type: 'Error', errorMessage: invokeResult.errorMessage }
    }

    const stepA = interpretParseCommandIntentClassificationBody(invokeResult.body)

    if (!isParseCommandAcmeOrderResult(stepA)) {
        return stepA
    }

    const validLines = stepA.orders.filter((o) => o.valid)
    if (validLines.length === 0) {
        return stepA
    }

    if (validLines.length > ACME_ORDER_ENRICH_MAX_LINES) {
        return mergeAcmeOrderWithEnrich(stepA, null, true)
    }

    const enrichPromptParts = buildParseAcmeOrderEnrichPrompt(
        input.command,
        validLines.map((l) => l.name)
    )
    const enrichInvoke = await invokeEnrich(enrichPromptParts)

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: AcmeOrderEnrichModelResponse | null = null

    if (enrichInvoke.success) {
        const parsed = interpretAcmeOrderEnrichBody(enrichInvoke.body, {
            slotCount: validLines.length,
            fallbackNames: validLines.map((l) => l.name),
        })
        if (parsed.success) {
            enrichResponse = parsed.response
        } else {
            enrichInvokeFailed = true
        }
    }

    return mergeAcmeOrderWithEnrich(stepA, enrichResponse, enrichInvokeFailed)
}
