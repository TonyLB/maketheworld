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
import {
    finalizeAcmeOrderFromStepB,
    interpretAcmeOrderEnrichBody,
} from './mergeAcmeOrderEnrich'
import { interpretParseCommandIntentClassificationBody } from './parseCommandIntentClassification'

/** Step B chain-of-reason Markdown only; use with {@link parseCommandWithEnrichReasoning} for harness review. */
export type ParseCommandWithEnrichReasoningResult = {
    result: ParseCommandResult;
    enrichReasoningMarkdown: string;
};

async function parseCommandCore(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    if (isCoyoteEngineTestSlashCommand(input.command)) {
        return { result: { type: 'CoyoteEngineTest', confidence: 1 }, enrichReasoningMarkdown: '' }
    }
    if (isCoyoteAffinitiesTestSlashCommand(input.command)) {
        return { result: { type: 'CoyoteAffinitiesTest', confidence: 1 }, enrichReasoningMarkdown: '' }
    }

    const invoke = deps.invokeBedrockParseCommandImpl ?? invokeBedrockParseCommand
    const invokeEnrich = deps.invokeBedrockAcmeOrderEnrichImpl ?? invokeBedrockAcmeOrderEnrich

    const prompt = buildParseCommandIntentClassificationPrompt(input.command)
    const invokeResult = await invoke(prompt)
    if (!invokeResult.success) {
        return { result: { type: 'Error', errorMessage: invokeResult.errorMessage }, enrichReasoningMarkdown: '' }
    }

    const stepA = interpretParseCommandIntentClassificationBody(invokeResult.body)

    if (!isParseCommandAcmeOrderIntentResult(stepA)) {
        return { result: stepA, enrichReasoningMarkdown: '' }
    }

    const enrichPromptParts = buildParseAcmeOrderEnrichPrompt(input.command)
    const enrichInvoke = await invokeEnrich(enrichPromptParts)

    let enrichInvokeFailed = !enrichInvoke.success
    let enrichResponse: AcmeOrderEnrichModelResponse | null = null
    let enrichReasoningMarkdown = ''

    if (enrichInvoke.success) {
        const fallback = input.command.trim() || 'order'
        const parsed = interpretAcmeOrderEnrichBody(enrichInvoke.body, {
            emptyFallbackName: fallback,
        })
        if (parsed.success) {
            enrichResponse = parsed.response
            enrichReasoningMarkdown = parsed.reasoningMarkdown
        } else {
            enrichInvokeFailed = true
        }
    }

    const fallbackName = input.command.trim() || 'order'
    const result = finalizeAcmeOrderFromStepB(
        stepA.confidence,
        enrichResponse,
        enrichInvokeFailed,
        fallbackName
    )
    return { result, enrichReasoningMarkdown }
}

/**
 * **`/test generation`** returns **`CoyoteEngineTest`**; **`/test affinities`** returns **`CoyoteAffinitiesTest`**; both without Bedrock.
 * Otherwise classifies via LLM (Step A), then runs Acme Step B when intent is **AcmeOrderIntent**.
 * Enrich chain-of-reason Markdown is not attached to **`AcmeOrder`**; use {@link parseCommandWithEnrichReasoning} when needed (e.g. affinities harness).
 */
export async function parseCommand(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandResult> {
    const { result } = await parseCommandCore(input, deps)
    return result
}

/**
 * Same pipeline as **`parseCommand`**, plus Step B **`enrichReasoningMarkdown`** for manual review (affinities harness). Does not add that string to **`AcmeOrder`**.
 */
export async function parseCommandWithEnrichReasoning(
    input: ParseCommandInput,
    deps: ParseCommandDeps = {}
): Promise<ParseCommandWithEnrichReasoningResult> {
    return parseCommandCore(input, deps)
}
