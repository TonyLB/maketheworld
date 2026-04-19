import {
    type AcmeOrderEnrichModelResponse,
} from '@tonylb/mtw-interfaces/ts/coyotePlanAffinities'
import { invokeBedrockAcmeOrderEnrich } from '../../generateExample/invokeBedrockAcmeOrderEnrich'
import { invokeBedrockParseCommand } from '../../generateExample/invokeBedrockParseCommand'
import type { ParseCommandDeps, ParseCommandInput, ParseCommandResult } from './baseClasses'
import {
    isParseCommandAcmeOrderIntentResult,
} from './baseClasses'
import { buildParseAcmeOrderEnrichPrompt } from './buildParseAcmeOrderEnrichPrompt'
import { buildParseCommandIntentClassificationPrompt } from './buildParseCommandIntentClassificationPrompt'
import { isCoyoteAffinitiesTestSlashCommand } from './coyoteAffinitiesTestSlashCommand'
import { isCoyoteEngineTestSlashCommand } from './coyoteEngineTestSlashCommand'
import { finalizeAcmeOrderFromStepB, interpretAcmeOrderEnrichBody } from './mergeAcmeOrderEnrich'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; both without Bedrock.
 * Otherwise classifies via LLM (Step A), then runs Acme Step B when intent is **AcmeOrderIntent**.
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

    if (!isParseCommandAcmeOrderIntentResult(stepA)) {
        return stepA
    }

    const enrichPromptParts = buildParseAcmeOrderEnrichPrompt(input.command)
    const enrichInvoke = await invokeEnrich(enrichPromptParts)

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: AcmeOrderEnrichModelResponse | null = null

    if (enrichInvoke.success) {
        const fallback = input.command.trim() || 'order'
        const parsed = interpretAcmeOrderEnrichBody(enrichInvoke.body, {
            emptyFallbackName: fallback,
        })
        if (parsed.success) {
            enrichResponse = parsed.response
        } else {
            enrichInvokeFailed = true
        }
    }

    const fallbackName = input.command.trim() || 'order'
    return finalizeAcmeOrderFromStepB(
        stepA.confidence,
        enrichResponse,
        enrichInvokeFailed,
        fallbackName
    )
}
